import React, { useEffect, useMemo, useState } from 'react'
import { timeEntriesService } from '../timeTracker/timeTrackerService'
import { projectsService } from '../projects/projectsService'
import { tasksService } from '../tasks/tasksService'
import { groupHours } from '../timeTracker/timeHistory'
import { clientsService } from '../clients/clientsService'
import { obligationsService } from '../obligations/obligationsService'
import { clientRatesService, userCostsService } from '../billing/ratesService'
import ProfitabilityView from './ProfitabilityView'
import { buildProfitability } from './profitability'
import { useAuth } from '../../hooks/useAuth'
import { can } from '../../services/permissions'
import { Cell, FMT_HOURS, FMT_MONEY, FMT_PCT, ReportData, downloadCsv, downloadXlsx } from '../../services/exportReport'
import { useUsers } from '../users/useUsers'
import { estimatedCharge, unpricedSeconds, formatClock, formatMoney } from '../../services/billing'
import { currentMonthValue, entryDate, inRange, monthLabel, monthOptions, monthRange } from '../../services/period'
import { Client, ClientRate, UserCost, Obligation, ObligationStatus, Project, Task, TimeEntry } from '../../models'

type ReportType = 'CLIENT_HOURS' | 'EMPLOYEE_HOURS' | 'OBLIGATIONS' | 'PROFITABILITY'

const TYPE_LABEL: Record<ReportType, string> = {
  CLIENT_HOURS: 'Horas por cliente',
  EMPLOYEE_HOURS: 'Horas por empleado',
  OBLIGATIONS: 'Obligaciones',
  PROFITABILITY: 'Rentabilidad',
}
const OBLIGATION_STATUS: Record<ObligationStatus, string> = { PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', DONE: 'Cumplida', OVERDUE: 'Vencida' }

const round2 = (n: number) => Math.round(n * 100) / 100

export default function ReportsPage() {
  const { profile } = useAuth()
  const canProfit = can(profile?.role, 'profitability.view') // depende del costo por hora: solo Admin/Superusuario
  const users = useUsers()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [rates, setRates] = useState<ClientRate[]>([])
  const [costs, setCosts] = useState<UserCost[]>([])
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const [type, setType] = useState<ReportType>('CLIENT_HOURS')
  const [period, setPeriod] = useState(currentMonthValue())
  const [clientId, setClientId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [withCharge, setWithCharge] = useState(false)
  const [obligationStatusFilter, setObligationStatusFilter] =
    useState<ObligationStatus | ''>('')

  useEffect(() => {
    const u1 = timeEntriesService.subscribe(setEntries)
    const u2 = clientsService.subscribe(setClients)
    const u3 = obligationsService.subscribe(setObligations)
    const u4 = projectsService.subscribe(setProjects)
    const u5 = tasksService.subscribe(setTasks)
    const u6 = clientRatesService.subscribe(setRates)
    return () => { u1(); u2(); u3(); u4(); u5(); u6() }
  }, [])

  useEffect(() => {
    if (!canProfit) return
    return userCostsService.subscribe(setCosts)
  }, [canProfit])

  const range = monthRange(period)
  const clientName = (id: string) => (id ? clients.find((c) => c.id === id)?.name ?? ('Cliente ' + id) : 'Sin cliente')
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? (id || 'Sin colaborador')

  const filtered = useMemo(
    () => entries
      .filter((e) => e.status === 'STOPPED' && inRange(entryDate(e), range))
      .filter((e) => !clientId || e.clientId === clientId)
      .filter((e) => !employeeId || e.userId === employeeId),
    [entries, period, clientId, employeeId] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const rows = useMemo(() => {
    const keyOf = (e: TimeEntry) => (type === 'CLIENT_HOURS' ? e.clientId : e.userId)
    const groups = new Map<string, TimeEntry[]>()
    for (const entry of filtered) {
      const key = keyOf(entry)
      const list = groups.get(key)
      if (list) list.push(entry)
      else groups.set(key, [entry])
    }
    return [...groups.entries()]
      .map(([key, list]) => ({
        key,
        name: type === 'CLIENT_HOURS' ? clientName(key) : userName(key),
        seconds: list.reduce((s, e) => s + e.duration, 0),
        charge: estimatedCharge(list, rates),
        detail: groupHours(list, [type === 'CLIENT_HOURS' ? 'userId' : 'clientId', 'projectId', 'taskId', 'description']),
      }))
      .sort((a, b) => b.seconds - a.seconds)
  }, [filtered, type, clients, users, rates]) // eslint-disable-line react-hooks/exhaustive-deps

  const obligationRows = obligations
    .filter((o) => !clientId || o.clientId === clientId)
    .filter((o) => !employeeId || o.assignedUserId === employeeId)
    .filter((o) => !obligationStatusFilter || o.status === obligationStatusFilter)
    .filter((o) => inRange(new Date(o.dueDate + 'T12:00:00').getTime(), range))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  const maxSeconds = Math.max(1, ...rows.map((r) => r.seconds))
  const totalSeconds = rows.reduce((s, r) => s + r.seconds, 0)
  const totalCharge = rows.reduce((s, r) => s + r.charge, 0)
  const unpriced = unpricedSeconds(filtered, rates)
  const isProfit = type === 'PROFITABILITY'
  const isHours = type === 'CLIENT_HOURS' || type === 'EMPLOYEE_HOURS'
  const profitability = useMemo(() => (isProfit ? buildProfitability(filtered, rates, costs) : null), [isProfit, filtered, rates, costs])

  // HU-47: arma el reporte con los mismos filtros que se ven en pantalla.
  const buildReportData = (): ReportData => {
    const filters: [string, string][] = [
      ['Periodo', monthLabel(period)],
      ['Cliente', clientId ? clientName(clientId) : 'Todos'],
      ['Empleado', employeeId ? userName(employeeId) : 'Todos'],
    ]
    const base = { title: TYPE_LABEL[type], generatedAt: new Date() }

    if (type === 'OBLIGATIONS') {
      filters.push(['Estado de obligación', obligationStatusFilter ? OBLIGATION_STATUS[obligationStatusFilter] : 'Todos'])
      return {
        ...base, filters,
        sections: [{
          headers: ['Obligación', 'Cliente', 'Responsable', 'Fecha límite', 'Estado'],
          rows: obligationRows.map((o) => [o.name, clientName(o.clientId), userName(o.assignedUserId), o.dueDate, OBLIGATION_STATUS[o.status]]),
        }],
      }
    }

    if (isProfit && profitability) {
      const { employees, clients: cl, totals } = profitability
      if (!totals.complete) filters.push(['Nota', 'Hay horas sin tarifa o sin costo por hora; las filas con observaciones están incompletas.'])
      return {
        ...base, filters,
        sections: [
          {
            title: 'Margen de utilidad por cliente',
            headers: ['Cliente', 'Horas', 'Ingreso (MXN)', 'Costo (MXN)', 'Utilidad (MXN)', 'Margen (%)', 'Observaciones'],
            numFmts: [undefined, FMT_HOURS, FMT_MONEY, FMT_MONEY, FMT_MONEY, FMT_PCT],
            rows: [
              ...cl.map((c): Cell[] => [
                clientName(c.clientId), round2(c.seconds / 3600), round2(c.revenue), round2(c.cost), round2(c.profit),
                c.marginPct === null ? null : round2(c.marginPct),
                [c.unpricedSeconds > 0 ? `Sin tarifa en ${round2(c.unpricedSeconds / 3600)} h` : '', c.uncostedSeconds > 0 ? `Sin costo por hora en ${round2(c.uncostedSeconds / 3600)} h` : ''].filter(Boolean).join('; '),
              ]),
              ['Total', round2(totals.seconds / 3600), round2(totals.revenue), round2(totals.cost), round2(totals.profit), totals.marginPct === null ? null : round2(totals.marginPct), ''],
            ],
          },
          {
            title: 'Costo operativo por colaborador',
            headers: ['Colaborador', 'Horas', 'Costo por hora (MXN)', 'Costo operativo (MXN)'],
            numFmts: [undefined, FMT_HOURS, FMT_MONEY, FMT_MONEY],
            rows: employees.map((e): Cell[] => [userName(e.userId), round2(e.seconds / 3600), e.hourlyCost, round2(e.operatingCost)]),
          },
        ],
      }
    }

    filters.push(['Incluye cobro estimado', withCharge ? 'Sí' : 'No'])
    if (withCharge && unpriced > 0) filters.push(['Nota', `${round2(unpriced / 3600)} h sin tarifa definida no se incluyen en el cobro.`])
    return {
      ...base, filters,
      sections: [{
        headers: [type === 'CLIENT_HOURS' ? 'Cliente' : 'Empleado', 'Horas', ...(withCharge ? ['Cobro estimado (MXN)'] : [])],
        numFmts: [undefined, FMT_HOURS, FMT_MONEY],
        rows: [
          ...rows.map((r): Cell[] => [r.name, round2(r.seconds / 3600), ...(withCharge ? [round2(r.charge)] : [])]),
          ['Total', round2(totalSeconds / 3600), ...(withCharge ? [round2(totalCharge)] : [])],
        ],
      }],
    }
  }

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExportError('')
    setExporting(true)
    try {
      const data = buildReportData()
      if (format === 'csv') downloadCsv(data)
      else await downloadXlsx(data)
    } catch (err) {
      console.error('Error al exportar el reporte:', err)
      setExportError('No se pudo generar el archivo. Inténtalo de nuevo.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="module-page">
      <h1>Reportes</h1>
      <p className="page-subtitle">Configura el reporte y expórtalo a PDF, CSV o Excel</p>

      <div className="report-layout">
        <div className="card config-panel">
          <h2>Configuración del reporte</h2>
          <div className="detail-row">
            <label>Tipo de reporte</label>
            <select value={type} onChange={(e) => setType(e.target.value as ReportType)}>
              {Object.entries(TYPE_LABEL).filter(([k]) => k !== 'PROFITABILITY' || canProfit).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="detail-row">
            <label>Periodo</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              {monthOptions().map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="detail-row">
            <label>Cliente</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Todos</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="detail-row">
            <label>Empleado</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Todos</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          {type === 'OBLIGATIONS' && (
            <div className="detail-row">
              <label>Estado de obligación</label>
              <select
                value={obligationStatusFilter}
                onChange={(e) =>
                  setObligationStatusFilter(
                    e.target.value as ObligationStatus | ''
                  )
                }
              >
                <option value="">Todos</option>
                {Object.entries(OBLIGATION_STATUS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}
          {isHours && (
            <label className="check-row">
              <input type="checkbox" checked={withCharge} onChange={(e) => setWithCharge(e.target.checked)} />
              Incluir cobro estimado
            </label>
          )}
          <button className="btn" style={{ width: '100%' }} onClick={() => window.print()}>Generar PDF</button>
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} disabled={exporting} onClick={() => handleExport('csv')}>Descargar CSV</button>
            <button className="btn btn-ghost" style={{ flex: 1 }} disabled={exporting} onClick={() => handleExport('xlsx')}>Descargar Excel</button>
          </div>
          {exportError && <p role="alert" className="overdue footnote">{exportError}</p>}
          <p className="footnote">Se abre el cuadro de impresión del navegador: elige «Guardar como PDF».</p>
        </div>

        <div className="card">
          <h2>Vista previa <small>PDF</small></h2>
          <div className="report-preview">
            <h3>{TYPE_LABEL[type]}</h3>
            <p className="report-meta">
              {monthLabel(period)} · {clientId ? clientName(clientId) : 'Todos los clientes'} · {employeeId ? userName(employeeId) : 'Todos los empleados'}
              <br />Generado el {new Date().toLocaleDateString('es-MX')}
            </p>

            {isProfit ? (
              profitability && <ProfitabilityView report={profitability} clientName={clientName} userName={userName} />
            ) : isHours ? (
              <>
                {rows.length === 0 && <p className="module-note">Sin registros para estos filtros.</p>}
                {rows.map((r) => (
                  <div className="bar-row" key={r.key} style={{ gridTemplateColumns: withCharge ? '110px 1fr 56px 80px' : '110px 1fr 56px' }}>
                    <span className="bar-label">{r.name}</span>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(r.seconds / maxSeconds) * 100}%` }} /></div>
                    <span className="bar-value">{formatClock(r.seconds)}</span>
                    {withCharge && <span className="bar-value">{formatMoney(r.charge)}</span>}
                  </div>
                ))}
                <div className="report-total">
                  <span>Total</span>
                  <span>{formatClock(totalSeconds)}{withCharge && ` · ${formatMoney(totalCharge)}`}</span>
                </div>
                {rows.map(row => (
                  <section key={row.key}>
                    <h4>{row.name} · {formatClock(row.seconds)}</h4>
                    <ul>{Array.from(row.detail, ([id, sub]) => (
                      <li key={id}>{type === 'CLIENT_HOURS' ? userName(id) : clientName(id)} · {formatClock(sub.seconds)}
                        <ul>{Array.from(sub.children, ([pid, project]) => (
                          <li key={pid}>{projects.find(p => p.id === pid)?.name || (pid ? 'Proyecto ' + pid : 'Sin proyecto')} · {formatClock(project.seconds)}
                            <ul>{Array.from(project.children, ([tid, task]) => (
                              <li key={tid}>{tasks.find(t => t.id === tid)?.title || (tid ? 'Tarea ' + tid : 'Sin tarea')} · {formatClock(task.seconds)}
                                <ul>{Array.from(task.children, ([activity, item]) => (
                                  <li key={activity}>{activity || 'Sin descripción'} · {formatClock(item.seconds)}</li>
                                ))}</ul>
                              </li>
                            ))}</ul>
                          </li>
                        ))}</ul>
                      </li>
                    ))}</ul>
                  </section>
                ))}
                {withCharge && (
                  <p className="footnote">
                    Cobro estimado con la tarifa vigente de cada cliente en la fecha trabajada.
                    {unpriced > 0 && ` ${formatClock(unpriced)} corresponden a clientes o fechas sin tarifa definida y no se incluyen en el cobro.`}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="report-meta">
                  Total: {obligationRows.length}
                  {' · '}Pendientes: {obligationRows.filter(
                    (o) => o.status === 'PENDING'
                  ).length}
                  {' · '}En progreso: {obligationRows.filter(
                    (o) => o.status === 'IN_PROGRESS'
                  ).length}
                  {' · '}Cumplidas: {obligationRows.filter(
                    (o) => o.status === 'DONE'
                  ).length}
                  {' · '}Vencidas: {obligationRows.filter(
                    (o) => o.status === 'OVERDUE'
                  ).length}
                </p>
                <table className="report-table">
                <thead><tr><th>Obligación</th><th>Cliente</th><th>Responsable</th><th>Fecha límite</th><th>Estado</th></tr></thead>
                <tbody>
                  {obligationRows.length === 0 && <tr><td colSpan={5} className="muted">Sin obligaciones en este periodo.</td></tr>}
                  {obligationRows.map((o) => (
                    <tr key={o.id}>
                      <td>{o.name}</td><td>{clientName(o.clientId)}</td><td>{userName(o.assignedUserId)}</td><td>{o.dueDate}</td><td>{OBLIGATION_STATUS[o.status]}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
