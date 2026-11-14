import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { where } from 'firebase/firestore'
import { tasksService } from '../tasks/tasksService'
import { STATUS_LABEL, PRIORITY_LABEL, isOverdue } from '../tasks/TasksPage'
import { projectsService } from '../projects/projectsService'
import { clientsService } from '../clients/clientsService'
import { timeEntriesService, startOfWeek } from '../timeTracker/timeTrackerService'
import { useUsers } from '../users/useUsers'
import { useAuth, homeRouteForRole } from '../../hooks/useAuth'
import { ROLE_LABEL } from '../../services/permissions'
import { formatHours } from '../../services/billing'
import { currentMonthValue, entryDate, initials, monthLabel, monthOptions, monthRange } from '../../services/period'
import { Client, Project, Task, TimeEntry } from '../../models'
import { buildTeamStats, WEEKLY_TARGET_HOURS } from './teamStats'

// HU-43 (Sprint 2): detalle de un colaborador al que se llega desde el dashboard del equipo.
export default function TeamMemberPage() {
  const { userId = '' } = useParams()
  const { profile } = useAuth()
  const users = useUsers()
  const [tasks, setTasks] = useState<Task[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [period, setPeriod] = useState(currentMonthValue())

  useEffect(() => {
    const u1 = tasksService.subscribe(setTasks, [where('assignedUserId', '==', userId)])
    const u2 = timeEntriesService.subscribe(setEntries, [where('userId', '==', userId)])
    const u3 = projectsService.subscribe(setProjects)
    const u4 = clientsService.subscribe(setClients)
    return () => { u1(); u2(); u3(); u4() }
  }, [userId])

  const member = users.find((u) => u.id === userId)
  const stats = useMemo(
    () => (member ? buildTeamStats([member], tasks, entries, startOfWeek(), monthRange(period), isOverdue)[0] : null),
    [member, tasks, entries, period]
  )

  if (!profile) return null
  const base = homeRouteForRole(profile.role)
  const back = <Link className="back-link" to={`${base}/team`}>← Volver al dashboard del equipo</Link>

  if (!member || !stats) return <div className="module-page">{back}<p>Cargando o colaborador no encontrado…</p></div>

  const projectOf = (id: string) => projects.find((p) => p.id === id)
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? '—'
  const range = monthRange(period)
  const periodEntries = entries
    .filter((e) => e.status === 'STOPPED' && entryDate(e) >= range[0] && entryDate(e) < range[1])
    .sort((a, b) => entryDate(b) - entryDate(a))
  const openTasks = tasks.filter((t) => t.status !== 'COMPLETED').sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
  const weekPct = Math.min(100, (stats.weekSeconds / (WEEKLY_TARGET_HOURS * 3600)) * 100)

  return (
    <div className="module-page">
      {back}
      <div className="task-header">
        <div className="avatar">{initials(member.name)}</div>
        <h1>{member.name}</h1>
        {stats.runningNow && <span className="status-pill status-active">● Cronómetro en curso</span>}
      </div>
      <p className="page-subtitle">{member.position ?? ROLE_LABEL[member.role]} · {member.email}</p>

      <div className="toolbar">
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          {monthOptions().map((m) => <option key={m.value} value={m.value}>Periodo: {m.label}</option>)}
        </select>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Horas esta semana</span>
          <span className="stat-value">{formatHours(stats.weekSeconds)}</span>
          <span className="stat-sub">meta {WEEKLY_TARGET_HOURS} h</span>
          <div className="bar-track" style={{ marginTop: '.4rem' }}><div className="bar-fill" style={{ width: `${weekPct}%` }} /></div>
        </div>
        <div className="stat-card"><span className="stat-label">Horas · {monthLabel(period)}</span><span className="stat-value">{formatHours(stats.monthSeconds)}</span></div>
        <div className="stat-card"><span className="stat-label">Tareas activas</span><span className="stat-value">{stats.activeTasks}</span><span className="stat-sub">{stats.overdueTasks} vencidas</span></div>
        <div className="stat-card"><span className="stat-label">Completadas en el periodo</span><span className="stat-value">{stats.completedInPeriod}</span></div>
      </div>

      <div className="dashboard-columns">
        <div className="card">
          <h2>Tareas abiertas <small>{openTasks.length}</small></h2>
          {openTasks.length === 0 ? <p className="module-note">Sin tareas abiertas.</p> : (
            <table className="report-table">
              <tbody>
                {openTasks.map((t) => (
                  <tr key={t.id}>
                    <td><Link to={`${base}/tasks/${t.id}`}>{t.title}</Link><br /><small className="muted">{projectOf(t.projectId)?.name ?? '—'}</small></td>
                    <td>{STATUS_LABEL[t.status]}<br /><small className="muted">Prioridad {PRIORITY_LABEL[t.priority].toLowerCase()}</small></td>
                    <td className={isOverdue(t) ? 'overdue' : 'muted'}>{t.dueDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>Registros de tiempo <small>{monthLabel(period)} · {periodEntries.length}</small></h2>
          {periodEntries.length === 0 ? <p className="module-note">Sin horas registradas en el periodo.</p> : (
            <table className="report-table">
              <tbody>
                {periodEntries.slice(0, 20).map((e) => (
                  <tr key={e.id}>
                    <td className="muted">{new Date(entryDate(e)).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</td>
                    <td>{e.description || '—'}<br /><small className="muted">{clientName(e.clientId)}</small></td>
                    <td style={{ textAlign: 'right' }}>{formatHours(e.duration)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {periodEntries.length > 20 && <p className="module-note">Mostrando los 20 más recientes.</p>}
        </div>
      </div>
    </div>
  )
}
