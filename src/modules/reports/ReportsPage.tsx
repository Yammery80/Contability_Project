import React, { useEffect, useMemo, useState } from 'react'
import { timeEntriesService } from '../timeTracker/timeTrackerService'
import { projectsService } from '../projects/projectsService'
import { tasksService } from '../tasks/tasksService'
import { groupHours } from '../timeTracker/timeHistory'
import { clientsService } from '../clients/clientsService'
import { obligationsService } from '../obligations/obligationsService'
import { useUsers } from '../users/useUsers'
import { estimatedCharge, formatClock, formatMoney } from '../../services/billing'
import { currentMonthValue, entryDate, inRange, monthLabel, monthOptions, monthRange } from '../../services/period'
import { Client, Obligation, ObligationStatus, Project, Task, TimeEntry } from '../../models'

type ReportType = 'CLIENT_HOURS' | 'EMPLOYEE_HOURS' | 'OBLIGATIONS'

const TYPE_LABEL: Record<ReportType, string> = {
  CLIENT_HOURS: 'Horas por cliente',
  EMPLOYEE_HOURS: 'Horas por empleado',
  OBLIGATIONS: 'Obligaciones',
}
const OBLIGATION_STATUS: Record<ObligationStatus, string> = { PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', DONE: 'Cumplida', OVERDUE: 'Vencida' }

export default function ReportsPage() {
  const users = useUsers()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [obligations, setObligations] = useState<Obligation[]>([])

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
    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [])

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
        charge: estimatedCharge(list, users),
        detail: groupHours(list, [type === 'CLIENT_HOURS' ? 'userId' : 'clientId', 'projectId', 'taskId', 'description']),
      }))
      .sort((a, b) => b.seconds - a.seconds)
  }, [filtered, type, clients, users]) // eslint-disable-line react-hooks/exhaustive-deps

  const obligationRows = obligations
    .filter((o) => !clientId || o.clientId === clientId)
    .filter((o) => !employeeId || o.assignedUserId === employeeId)
    .filter((o) => !obligationStatusFilter || o.status === obligationStatusFilter)
    .filter((o) => inRange(new Date(o.dueDate + 'T12:00:00').getTime(), range))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  const maxSeconds = Math.max(1, ...rows.map((r) => r.seconds))
  const totalSeconds = rows.reduce((s, r) => s + r.seconds, 0)
  const totalCharge = rows.reduce((s, r) => s + r.charge, 0)
  const isHours = type !== 'OBLIGATIONS'

  return (
    <div className="module-page">
      <h1>Reportes</h1>
      <p className="page-subtitle">Configura el reporte y expórtalo a PDF</p>

      <div className="report-layout">
        <div className="card config-panel">
          <h2>Configuración del reporte</h2>
          <div className="detail-row">
            <label>Tipo de reporte</label>
            <select value={type} onChange={(e) => setType(e.target.value as ReportType)}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
          {!isHours && (
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

            {isHours ? (
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
                {withCharge && <p className="footnote">Cobro estimado con tarifas de ejemplo por nivel (pendientes de definir por la empresa).</p>}
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
