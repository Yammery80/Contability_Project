import React, { useEffect, useMemo, useState } from 'react'
import { where } from 'firebase/firestore'
import { useAuth } from '../../hooks/useAuth'
import { tasksService } from '../tasks/tasksService'
import { isOverdue } from '../tasks/TasksPage'
import { projectsService } from '../projects/projectsService'
import { clientsService } from '../clients/clientsService'
import { obligationsService, obligationSemaphore } from '../obligations/obligationsService'
import { timeEntriesService } from '../timeTracker/timeTrackerService'
import { useUsers } from '../users/useUsers'
import { entryLevel, estimatedCharge, formatCompactMoney, formatHours } from '../../services/billing'
import { currentMonthValue, entryDate, inRange, monthOptions, monthRange } from '../../services/period'
import { Client, Obligation, Project, Task, TimeEntry } from '../../models'

function StatCard({ label, value, sub, highlight }: { label: string; value: React.ReactNode; sub?: string; highlight?: boolean }) {
  return (
    <div className={'stat-card' + (highlight ? ' highlight' : '')}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  )
}

function Bars({ rows }: { rows: { key: string; name: string; seconds: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.seconds))
  if (rows.length === 0) return <p className="module-note">Sin horas registradas en el periodo.</p>
  return (
    <>
      {rows.map((r) => (
        <div className="bar-row" key={r.key}>
          <span className="bar-label">{r.name}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(r.seconds / max) * 100}%` }} /></div>
          <span className="bar-value">{formatHours(r.seconds)}</span>
        </div>
      ))}
    </>
  )
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const users = useUsers()
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])

  const [period, setPeriod] = useState(currentMonthValue())
  const [employee, setEmployee] = useState('')
  const [clientId, setClientId] = useState('')

  const isOperator = profile?.role === 'OPERATOR'

  useEffect(() => {
    const u1 = tasksService.subscribe(setTasks)
    const u2 = projectsService.subscribe(setProjects)
    const u3 = clientsService.subscribe(setClients)
    const u4 = obligationsService.subscribe(setObligations)
    return () => { u1(); u2(); u3(); u4() }
  }, [])

  // El Operador solo ve sus propios registros de tiempo (reglas de Firestore).
  useEffect(() => {
    if (!profile) return
    return timeEntriesService.subscribe(setEntries, isOperator ? [where('userId', '==', profile.id)] : [])
  }, [profile, isOperator])

  const clientOfProject = useMemo(() => new Map(projects.map((p) => [p.id, p.clientId])), [projects])

  const pick = (offset: number) => {
    const range = monthRange(period, offset)
    return entries
      .filter((e) => e.status === 'STOPPED' && inRange(entryDate(e), range))
      .filter((e) => !clientId || e.clientId === clientId)
      .filter((e) => !employee || e.userId === employee)
  }
  const current = useMemo(() => pick(0), [entries, period, clientId, employee]) // eslint-disable-line react-hooks/exhaustive-deps
  const previous = useMemo(() => pick(-1), [entries, period, clientId, employee]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile) return null

  const totalSeconds = current.reduce((s, e) => s + e.duration, 0)
  const prevSeconds = previous.reduce((s, e) => s + e.duration, 0)
  const delta = prevSeconds > 0 ? Math.round(((totalSeconds - prevSeconds) / prevSeconds) * 100) : null

  const scopedTasks = tasks
    .filter((t) => !isOperator || t.assignedUserId === profile.id)
    .filter((t) => !employee || t.assignedUserId === employee)
    .filter((t) => !clientId || clientOfProject.get(t.projectId) === clientId)
  const active = scopedTasks.filter((t) => t.status !== 'COMPLETED')
  const overdue = scopedTasks.filter(isOverdue)
  const soon = active.filter((t) => {
    if (!t.dueDate || isOverdue(t)) return false
    const days = (new Date(t.dueDate + 'T23:59:59').getTime() - Date.now()) / 86400000
    return days <= 3
  })

  const group = (keyOf: (e: TimeEntry) => string, nameOf: (k: string) => string) => {
    const m = new Map<string, number>()
    current.forEach((e) => m.set(keyOf(e), (m.get(keyOf(e)) ?? 0) + e.duration))
    return [...m.entries()].map(([key, seconds]) => ({ key, name: nameOf(key), seconds })).sort((a, b) => b.seconds - a.seconds).slice(0, 5)
  }
  const byEmployee = group((e) => e.userId, (k) => users.find((u) => u.id === k)?.name ?? '—')
  const byClient = group((e) => e.clientId, (k) => (k ? clients.find((c) => c.id === k)?.name ?? '—' : 'Sin cliente'))

  const adminSeconds = current.filter((e) => entryLevel(e, users) === 'ADMIN').reduce((s, e) => s + e.duration, 0)
  const adminPct = totalSeconds > 0 ? Math.round((adminSeconds / totalSeconds) * 100) : 0

  const upcoming = obligations
    .filter((o) => o.status !== 'DONE' && (!clientId || o.clientId === clientId))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6)

  return (
    <div className="module-page">
      <h1>{isOperator ? 'Mi panel' : 'Panel de control'}</h1>
      <p className="page-subtitle">Hola, {profile.name}</p>

      <div className="toolbar">
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          {monthOptions().map((m) => <option key={m.value} value={m.value}>Periodo: {m.label}</option>)}
        </select>
        {!isOperator && (
          <select value={employee} onChange={(e) => setEmployee(e.target.value)}>
            <option value="">Empleado: Todos</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Cliente: Todos</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn push-right no-print" onClick={() => window.print()}>Generar PDF</button>
      </div>

      <div className="stats-grid">
        <StatCard label="Horas totales" value={formatHours(totalSeconds)} sub={delta === null ? 'Sin datos del mes anterior' : `${delta >= 0 ? '+' : ''}${delta}% vs. mes anterior`} />
        <StatCard label="Tareas activas" value={active.length} sub={`${soon.length} próximas a vencer`} />
        <StatCard label="Tareas vencidas" value={overdue.length} sub="requieren atención" />
        {!isOperator && <StatCard highlight label="Cobro estimado" value={formatCompactMoney(estimatedCharge(current, users))} sub="según tarifa por nivel (ejemplo)" />}
      </div>

      {!isOperator && (
        <div className="dashboard-columns">
          <div className="card"><h2>Tiempo por empleado <small>horas del periodo</small></h2><Bars rows={byEmployee} /></div>
          <div className="card"><h2>Tiempo por cliente <small>horas del periodo</small></h2><Bars rows={byClient} /></div>
        </div>
      )}
      {isOperator && (
        <div className="card" style={{ marginBottom: '1.1rem' }}><h2>Tiempo por cliente <small>horas del periodo</small></h2><Bars rows={byClient} /></div>
      )}

      {!isOperator && (
        <div className="card" style={{ marginBottom: '1.1rem' }}>
          <h2>Distribución del tiempo <small>administradores vs. contadores</small></h2>
          <div className="stack-bar"><div className="seg-a" style={{ width: `${adminPct}%` }} /><div className="seg-b" style={{ width: `${totalSeconds > 0 ? 100 - adminPct : 100}%` }} /></div>
          <div className="legend">
            <span><i style={{ background: 'var(--accent)' }} />Administradores · {adminPct}%</span>
            <span><i style={{ background: '#dfe4ee' }} />Contadores · {totalSeconds > 0 ? 100 - adminPct : 0}%</span>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Obligaciones próximas</h2>
        {upcoming.length === 0 ? <p className="module-note">Sin obligaciones próximas.</p> : (
          <table className="report-table">
            <tbody>
              {upcoming.map((o) => (
                <tr key={o.id}>
                  <td style={{ width: 24 }}><span className={'semaphore ' + obligationSemaphore(o.dueDate, o.status)} /></td>
                  <td>{o.name}</td>
                  <td className="muted">{clients.find((c) => c.id === o.clientId)?.name ?? '—'}</td>
                  <td className="muted">{o.dueDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
