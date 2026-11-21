import React, { useEffect, useMemo, useRef, useState } from 'react'
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
import { usersService } from '../users/usersService'
import type { createFirestoreService } from '../../services/firestoreService'
import { estimatedCharge, unpricedSeconds, formatClock, formatMoney } from '../../services/billing'
import { currentMonthValue, monthLabel, monthOptions, monthRange } from '../../services/period'
import { AppUser, Client, ClientRate, UserCost, Obligation, ObligationStatus, Project, Task, TimeEntry } from '../../models'
import { activitySection, indexById, missingFields, obligationActivity, obligationStatus as OBLIGATION_STATUS, reportedTime, selectActivities, timeActivity } from './activityDetail'
import ReportActivities from './ReportActivities'
import ReportPrintout from './ReportPrintout'

type ReportType = 'CLIENT_HOURS' | 'EMPLOYEE_HOURS' | 'OBLIGATIONS' | 'PROFITABILITY'

const TYPE_LABEL: Record<ReportType, string> = {
  CLIENT_HOURS: 'Horas por cliente',
  EMPLOYEE_HOURS: 'Horas por empleado',
  OBLIGATIONS: 'Obligaciones',
  PROFITABILITY: 'Rentabilidad',
}
type Source = 'entries' | 'clients' | 'users' | 'projects' | 'tasks' | 'obligations' | 'rates' | 'costs'

const round2 = (n: number) => Math.round(n * 100) / 100

export default function ReportsPage() {
  const { profile } = useAuth()
  const canProfit = can(profile?.role, 'profitability.view') // depende del costo por hora: solo Admin/Superusuario
  const [users, setUsers] = useState<AppUser[]>([])
  const [sources, setSources] = useState<Partial<Record<Source, 'ready' | 'error'>>>({})
  const [retry, setRetry] = useState(0)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [rates, setRates] = useState<ClientRate[]>([])
  const [costs, setCosts] = useState<UserCost[]>([])
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const printLogo = useRef<HTMLImageElement>(null)

  const [type, setType] = useState<ReportType>('CLIENT_HOURS')
  const [period, setPeriod] = useState(currentMonthValue())
  const [clientId, setClientId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [withCharge, setWithCharge] = useState(false)
  const [obligationStatusFilter, setObligationStatusFilter] =
    useState<ObligationStatus | ''>('')

  useEffect(() => {
    setSources({})
    if (!can(profile?.role, 'reports.view')) return
    let active = true
    function callbacks<T>(key: Source, set: (values: T[]) => void) {
      const mark = (state: 'ready' | 'error') => setSources(old => old[key] === state ? old : { ...old, [key]: state })
      return [(values: T[]) => { if (active) { set(values); mark('ready') } }, () => { if (active) mark('error') }] as const
    }
    function watch<T extends { id: string }>(key: Source, service: ReturnType<typeof createFirestoreService<T>>, set: (values: T[]) => void) {
      const [next, failed] = callbacks(key, set)
      return service.subscribe(next, [], failed)
    }
    const stops = [watch('entries', timeEntriesService, setEntries), watch('clients', clientsService, setClients),
      watch('users', usersService, setUsers), watch('obligations', obligationsService, setObligations),
      watch('projects', projectsService, setProjects), watch('tasks', tasksService, setTasks), watch('rates', clientRatesService, setRates)]
    if (canProfit) stops.push(userCostsService.subscribe(...callbacks('costs', setCosts)))
    return () => { active = false; stops.forEach(stop => stop()) }
  }, [profile?.id, profile?.role, canProfit, retry])

  const directory = useMemo(() => ({ clients: indexById(clients), users: indexById(users),
    projects: indexById(projects), tasks: indexById(tasks) }), [clients, users, projects, tasks])
  const times = useMemo(() => entries.filter(e => e.status === 'STOPPED').map(entry => {
    const record = timeActivity(entry, directory)
    return { record, entry: reportedTime(entry, record) }
  }), [entries, directory])
  const duties = useMemo(() => obligations.map(obligation => ({ obligation, record: obligationActivity(obligation, directory) })),
    [obligations, directory])
  const selectedTimes = useMemo(() => selectActivities(times, clientId, employeeId, monthRange(period)),
    [times, clientId, employeeId, period])
  const selectedDuties = useMemo(() => selectActivities(
    duties.filter(({ obligation }) => !obligationStatusFilter || obligation.status === obligationStatusFilter),
    clientId, employeeId, monthRange(period)), [duties, obligationStatusFilter, clientId, employeeId, period])
  const filtered = useMemo(() => selectedTimes.dated.map(({ entry }) => entry), [selectedTimes])
  const isObligations = type === 'OBLIGATIONS'
  const selected = isObligations ? selectedDuties : selectedTimes
  const { undated } = selected
  const records = useMemo(() => selected.dated.map(item => item.record), [selected])
  const obligationRows = selectedDuties.dated.map(({ obligation, record }) => ({ ...obligation, clientId: record.detail.clientId, dueDate: record.detail.date }))
  const statusCounts = { PENDING: 0, IN_PROGRESS: 0, DONE: 0, OVERDUE: 0 }
  for (const row of obligationRows) statusCounts[row.status]++
  const { clientNames, userNames } = useMemo(() => {
    const clientNames = new Map(clients.map(c => [c.id, c.name]))
    const userNames = new Map(users.map(u => [u.id, u.name]))
    for (const { record: { detail } } of [...times, ...duties]) {
      if (!clientNames.get(detail.clientId) && detail.clientName) clientNames.set(detail.clientId, detail.clientName)
      if (!userNames.get(detail.userId) && detail.responsibleName) userNames.set(detail.userId, detail.responsibleName)
    }
    return { clientNames, userNames }
  }, [clients, users, times, duties])
  const clientName = (id: string) => clientNames.get(id) || 'Sin nombre de cliente'
  const userName = (id: string) => userNames.get(id) || 'Sin nombre de responsable'

  const rows = useMemo(() => {
    if (type !== 'CLIENT_HOURS' && type !== 'EMPLOYEE_HOURS') return []
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
        charge: withCharge ? estimatedCharge(list, rates) : 0,
        detail: groupHours(list, [type === 'CLIENT_HOURS' ? 'userId' : 'clientId', 'projectId', 'taskId', 'description']),
      }))
      .sort((a, b) => b.seconds - a.seconds)
  }, [filtered, type, clientNames, userNames, rates, withCharge]) // eslint-disable-line react-hooks/exhaustive-deps

  const maxSeconds = Math.max(1, ...rows.map((r) => r.seconds))
  const totalSeconds = rows.reduce((s, r) => s + r.seconds, 0)
  const totalCharge = rows.reduce((s, r) => s + r.charge, 0)
  const unpriced = withCharge ? unpricedSeconds(filtered, rates) : 0
  const isProfit = type === 'PROFITABILITY'
  const isHours = type === 'CLIENT_HOURS' || type === 'EMPLOYEE_HOURS'
  const profitability = useMemo(() => (isProfit ? buildProfitability(filtered, rates, costs) : null), [isProfit, filtered, rates, costs])
  const required: Source[] = isObligations ? ['clients', 'users', 'obligations'] : ['clients', 'users', 'entries', 'tasks', 'projects']
  if (isProfit || (isHours && withCharge)) required.push('rates')
  if (isProfit) required.push('costs')
  const loadFailed = required.some(key => sources[key] === 'error')
  const loading = required.some(key => !sources[key])
  const incomplete = records.filter(row => missingFields(row.detail).length > 0).length
  const blocked = loadFailed || loading || incomplete > 0 || undated.length > 0 || !records.length || (isProfit && !canProfit)

  // HU-47: arma el reporte con los mismos filtros que se ven en pantalla.
  const buildSummary = (print = false): ReportData => {
    const hours = (seconds: number) => print ? formatClock(seconds) : round2(seconds / 3600)
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
        sections: [...(print ? [{
          title: 'Estado de las obligaciones',
          headers: ['Pendientes', 'En progreso', 'Cumplidas', 'Vencidas', 'Total'],
          rows: [[statusCounts.PENDING, statusCounts.IN_PROGRESS, statusCounts.DONE, statusCounts.OVERDUE, obligationRows.length]],
        }] : []), {
          title: print ? 'Obligaciones del periodo' : undefined,
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
                clientName(c.clientId), hours(c.seconds), round2(c.revenue), round2(c.cost), round2(c.profit),
                c.marginPct === null ? null : round2(c.marginPct),
                [c.unpricedSeconds > 0 ? `Sin tarifa en ${round2(c.unpricedSeconds / 3600)} h` : '', c.uncostedSeconds > 0 ? `Sin costo por hora en ${round2(c.uncostedSeconds / 3600)} h` : ''].filter(Boolean).join('; '),
              ]),
              ['Total', hours(totals.seconds), round2(totals.revenue), round2(totals.cost), round2(totals.profit), totals.marginPct === null ? null : round2(totals.marginPct), ''],
            ],
          },
          {
            title: 'Costo operativo por colaborador',
            headers: ['Colaborador', 'Horas', 'Costo por hora (MXN)', 'Costo operativo (MXN)'],
            numFmts: [undefined, FMT_HOURS, FMT_MONEY, FMT_MONEY],
            rows: employees.map((e): Cell[] => [userName(e.userId), hours(e.seconds), e.hourlyCost, round2(e.operatingCost)]),
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
          ...rows.map((r): Cell[] => [r.name, hours(r.seconds), ...(withCharge ? [round2(r.charge)] : [])]),
          ['Total', hours(totalSeconds), ...(withCharge ? [round2(totalCharge)] : [])],
        ],
      }],
    }
  }

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (blocked || exporting) return
    setExportError('')
    setExporting(true)
    try {
      const summary = buildSummary()
      const detail = activitySection(isObligations ? 'obligations' : 'timeEntries', records)
      const data = { ...summary, sections: [...summary.sections, detail] }
      if (format === 'csv') downloadCsv(data)
      else await downloadXlsx(data)
    } catch (err) {
      console.error('Error al exportar el reporte:', err)
      setExportError('No se pudo generar el archivo. Inténtalo de nuevo.')
    } finally {
      setExporting(false)
    }
  }

  const handlePrint = async () => {
    if (blocked || !printLogo.current) return
    setExportError('')
    try {
      await printLogo.current.decode()
      window.print()
    } catch {
      setExportError('No se pudo cargar el logotipo para imprimir. Vuelve a intentarlo.')
    }
  }

  return (
    <div className="module-page">
      <ReportPrintout report={blocked ? null : buildSummary(true)} records={records} issuer={profile?.name} logoRef={printLogo} />
      <h1>Reportes</h1>
      <p className="page-subtitle">Configura el reporte y expórtalo a PDF, CSV o Excel</p>

      <div className="report-layout">
        <div className="card config-panel">
          <h2>Configuración del reporte</h2>
          <div className="detail-row">
            <label htmlFor="report-type">Tipo de reporte</label>
            <select id="report-type" value={type} onChange={(e) => setType(e.target.value as ReportType)}>
              {Object.entries(TYPE_LABEL).filter(([k]) => k !== 'PROFITABILITY' || canProfit).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="detail-row">
            <label htmlFor="report-period">Periodo</label>
            <select id="report-period" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {monthOptions().map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="detail-row">
            <label htmlFor="report-client">Cliente</label>
            <select id="report-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Todos</option>
              {Array.from(clientNames, ([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
          <div className="detail-row">
            <label htmlFor="report-employee">Empleado</label>
            <select id="report-employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Todos</option>
              {Array.from(userNames, ([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
          {type === 'OBLIGATIONS' && (
            <div className="detail-row">
              <label htmlFor="report-obligation-status">Estado de obligación</label>
              <select
                id="report-obligation-status"
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
          <button className="btn" style={{ width: '100%' }} disabled={blocked} onClick={handlePrint}>Generar PDF</button>
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} disabled={blocked || exporting} onClick={() => handleExport('csv')}>Descargar CSV</button>
            <button className="btn btn-ghost" style={{ flex: 1 }} disabled={blocked || exporting} onClick={() => handleExport('xlsx')}>Descargar Excel</button>
          </div>
          {exportError && <p role="alert" className="overdue footnote">{exportError}</p>}
          {loadFailed ? <p role="alert">No se pudieron cargar los datos del reporte. <button type="button" onClick={() => setRetry(n => n + 1)}>Reintentar</button></p>
            : loading ? <p role="status">Cargando los datos del reporte…</p>
            : <>
              {incomplete > 0 && <p role="status">Registros por completar: {incomplete}. Abre «Completar detalle» antes de exportar.</p>}
              {undated.length > 0 && <p role="status">Hay {undated.length} registro(s) sin fecha. Indica la fecha para ubicarlos en su periodo.</p>}
              {!records.length && !undated.length && <p className="footnote">No hay registros para exportar con estos filtros.</p>}
            </>}
          <p className="footnote">Se abre el cuadro de impresión del navegador: elige «Guardar como PDF».</p>
        </div>

        <div className="card">
          <h2>Resumen y actividades</h2>
          <div className="report-preview">
            <h3>{TYPE_LABEL[type]}</h3>
            <p className="report-meta">
              {monthLabel(period)} · {clientId ? clientName(clientId) : 'Todos los clientes'} · {employeeId ? userName(employeeId) : 'Todos los empleados'}
              <br />Generado el {new Date().toLocaleDateString('es-MX')}
            </p>

            {loading || loadFailed || (isProfit && !canProfit) ? null : isProfit ? (
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
                  {' · '}Pendientes: {statusCounts.PENDING}
                  {' · '}En progreso: {statusCounts.IN_PROGRESS}
                  {' · '}Cumplidas: {statusCounts.DONE}
                  {' · '}Vencidas: {statusCounts.OVERDUE}
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
            {!loadFailed && !loading && <ReportActivities key={type + period + clientId + employeeId + obligationStatusFilter}
              records={[...undated, ...records]} clients={directory.clients} users={directory.users} canEditClient={can(profile?.role, 'clients.edit')} />}
          </div>
        </div>
      </div>
    </div>
  )
}
