import React, { useEffect, useMemo, useState } from 'react'
import { where } from 'firebase/firestore'
import { useAuth } from '../../hooks/useAuth'
import { tasksService } from '../tasks/tasksService'
import { projectsService } from '../projects/projectsService'
import { obligationsService, obligationSemaphore } from '../obligations/obligationsService'
import { timeEntriesService, formatHoursMinutes, startOfWeek } from '../timeTracker/timeTrackerService'
import { clientsService } from '../clients/clientsService'
import { Task, Project, Obligation, TimeEntry, Client } from '../../models'

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="stat-card">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [clients, setClients] = useState<Client[]>([])

  useEffect(() => {
    const unsubT = tasksService.subscribe(setTasks)
    const unsubP = projectsService.subscribe(setProjects)
    const unsubO = obligationsService.subscribe(setObligations)
    const unsubC = clientsService.subscribe(setClients)
    return () => { unsubT(); unsubP(); unsubO(); unsubC() }
  }, [])

  useEffect(() => {
    if (!profile) return
    const constraints = profile.role === 'OPERATOR' ? [where('userId', '==', profile.id)] : []
    return timeEntriesService.subscribe(setTimeEntries, constraints)
  }, [profile])

  const weekSeconds = useMemo(() => {
    const weekStart = startOfWeek()
    return timeEntries.filter((e) => e.status !== 'RUNNING' && (e.endTime ?? 0) >= weekStart).reduce((s, e) => s + e.duration, 0)
  }, [timeEntries])

  if (!profile) return null

  const myTasks = tasks.filter((t) => t.assignedUserId === profile.id)
  const pendingTasks = (profile.role === 'OPERATOR' ? myTasks : tasks).filter((t) => t.status !== 'COMPLETED')
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE')
  const upcomingObligations = obligations
    .filter((o) => o.status !== 'DONE')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6)

  return (
    <div className="module-page">
      <h1>Bienvenido/a, {profile.name}</h1>

      <div className="stats-grid">
        <StatCard label="Proyectos activos" value={activeProjects.length} />
        <StatCard label={profile.role === 'OPERATOR' ? 'Mis tareas pendientes' : 'Tareas pendientes'} value={pendingTasks.length} />
        <StatCard label="Horas registradas (semana)" value={formatHoursMinutes(weekSeconds)} />
        <StatCard label="Obligaciones próximas" value={upcomingObligations.length} />
        {profile.role !== 'OPERATOR' && <StatCard label="Clientes" value={clients.length} />}
      </div>

      <div className="dashboard-columns">
        <div className="dashboard-panel">
          <h2>Obligaciones próximas</h2>
          {upcomingObligations.length === 0 ? <p className="module-note">Sin obligaciones próximas.</p> : (
            <ul className="mini-list">
              {upcomingObligations.map((o) => (
                <li key={o.id}>
                  <span className={'semaphore ' + obligationSemaphore(o.dueDate, o.status)} />
                  {o.name} <small>({o.dueDate})</small>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="dashboard-panel">
          <h2>{profile.role === 'OPERATOR' ? 'Mis tareas' : 'Actividad reciente'}</h2>
          {pendingTasks.length === 0 ? <p className="module-note">Sin tareas pendientes.</p> : (
            <ul className="mini-list">
              {pendingTasks.slice(0, 8).map((t) => (
                <li key={t.id}>{t.title} <small>({t.status})</small></li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
