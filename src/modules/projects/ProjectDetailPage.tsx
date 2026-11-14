import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { where } from 'firebase/firestore'
import { projectsService } from './projectsService'
import { clientsService } from '../clients/clientsService'
import { tasksService } from '../tasks/tasksService'
import { timeEntriesService } from '../timeTracker/timeTrackerService'
import { STATUS_LABEL as TASK_STATUS_LABEL, PRIORITY_LABEL, isOverdue } from '../tasks/TasksPage'
import { useUsers } from '../users/useUsers'
import { useAuth, homeRouteForRole } from '../../hooks/useAuth'
import { formatHours } from '../../services/billing'
import { secondsByTask, summarizeProject } from './projectStats'
import { Client, Project, ProjectStatus, Task, TimeEntry } from '../../models'

const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNED: 'Planeado', ACTIVE: 'Activo', COMPLETED: 'Completado', CANCELLED: 'Cancelado',
}

// HU-18: detalle del proyecto con sus tareas, responsables, estado y horas acumuladas.
export default function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const { profile } = useAuth()
  const users = useUsers()

  const [project, setProject] = useState<Project | null | undefined>(undefined) // undefined = cargando
  const [client, setClient] = useState<Client | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])

  useEffect(() => {
    const u1 = projectsService.subscribeOne(projectId, setProject)
    const u2 = tasksService.subscribe(setTasks, [where('projectId', '==', projectId)])
    const u3 = timeEntriesService.subscribe(setEntries, [where('projectId', '==', projectId)])
    return () => { u1(); u2(); u3() }
  }, [projectId])

  useEffect(() => {
    if (!project?.clientId) { setClient(null); return }
    clientsService.getById(project.clientId).then(setClient).catch(() => setClient(null))
  }, [project?.clientId])

  const perTask = useMemo(() => secondsByTask(entries), [entries])
  const summary = useMemo(() => summarizeProject(tasks, entries), [tasks, entries])

  if (!profile) return null
  const base = homeRouteForRole(profile.role)
  const back = <Link className="back-link" to={`${base}/projects`}>← Volver a proyectos</Link>

  if (project === undefined) return <div className="module-page">{back}<p>Cargando…</p></div>
  if (project === null) return <div className="module-page">{back}<p>El proyecto no existe o no tienes acceso a él.</p></div>

  const userName = (id: string) => (id ? users.find((u) => u.id === id)?.name ?? '—' : 'Sin asignar')
  const sortedTasks = [...tasks].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))

  return (
    <div className="module-page">
      {back}
      <div className="task-header">
        <h1>{project.name}</h1>
        <span className={'status-pill status-' + project.status.toLowerCase()}>{PROJECT_STATUS_LABEL[project.status]}</span>
      </div>
      <p className="page-subtitle">
        {client?.name ?? '—'} · Supervisor: {userName(project.supervisorId)} · {project.startDate || 'sin inicio'} → {project.endDate || 'sin fin'}
      </p>
      {project.description && <p style={{ marginTop: 0 }}>{project.description}</p>}

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Avance</span>
          <span className="stat-value">{summary.progressPct}%</span>
          <span className="stat-sub">{summary.completedTasks} de {summary.totalTasks} tareas completadas</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Horas acumuladas</span>
          <span className="stat-value">{formatHours(summary.totalSeconds)}</span>
          <span className="stat-sub">{summary.estimatedHours > 0 ? `de ${summary.estimatedHours} h estimadas` : 'sin horas estimadas'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Tareas vencidas</span>
          <span className="stat-value">{tasks.filter(isOverdue).length}</span>
          <span className="stat-sub">requieren atención</span>
        </div>
      </div>

      <div className="card">
        <h2>Tareas del proyecto <small>{tasks.length}</small></h2>
        {sortedTasks.length === 0 ? (
          <p className="module-note">Este proyecto todavía no tiene tareas.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarea</th><th>Responsable</th><th>Estado</th><th>Prioridad</th><th>Vence</th>
                <th className="num">Horas</th>
              </tr>
            </thead>
            <tbody>
              {sortedTasks.map((t) => (
                <tr key={t.id}>
                  <td><Link to={`${base}/tasks/${t.id}`}>{t.title}</Link></td>
                  <td>{userName(t.assignedUserId)}</td>
                  <td>{TASK_STATUS_LABEL[t.status]}</td>
                  <td>{PRIORITY_LABEL[t.priority]}</td>
                  <td className={isOverdue(t) ? 'overdue' : ''}>{t.dueDate || '—'}</td>
                  <td className="num">
                    {formatHours(perTask.get(t.id) ?? 0)}
                    {!!t.estimatedHours && <small className="muted"> / {t.estimatedHours} h</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
