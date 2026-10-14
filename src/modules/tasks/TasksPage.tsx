import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { tasksService } from './tasksService'
import { projectsService } from '../projects/projectsService'
import { clientsService } from '../clients/clientsService'
import { useUsers } from '../users/useUsers'
import { useAuth, homeRouteForRole } from '../../hooks/useAuth'
import { notifyUser } from '../../services/notify'
import { can } from '../../services/permissions'
import { Task, TaskStatus, TaskPriority, Project, Client } from '../../models'

export const STATUS_LABEL: Record<TaskStatus, string> = { PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', COMPLETED: 'Completada' }
export const PRIORITY_LABEL: Record<TaskPriority, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta' }
const COLUMNS: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED']

const emptyForm = {
  projectId: '', title: '', description: '', assignedUserId: '',
  priority: 'MEDIUM' as TaskPriority, dueDate: '', estimatedHours: '',
}

export function isOverdue(t: Task): boolean {
  return t.status !== 'COMPLETED' && !!t.dueDate && new Date(t.dueDate + 'T23:59:59').getTime() < Date.now()
}

// onlyMine=true restringe el tablero a las tareas asignadas al usuario en sesión (Operador).
export default function TasksPage({ onlyMine = false }: { onlyMine?: boolean }) {
  const { profile } = useAuth()
  const users = useUsers()
  const [params, setParams] = useSearchParams()
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(params.get('new') === '1')
  const [search, setSearch] = useState('')
  const [assignee, setAssignee] = useState('')

  useEffect(() => {
    const u1 = tasksService.subscribe((items) => { setTasks(items); setLoading(false) })
    const u2 = projectsService.subscribe(setProjects)
    const u3 = clientsService.subscribe(setClients)
    return () => { u1(); u2(); u3() }
  }, [])

  // "+ Nueva tarea" de la barra superior llega con ?new=1
  useEffect(() => {
    if (params.get('new') === '1') setShowForm(true)
  }, [params])

  if (!profile) return null
  const base = homeRouteForRole(profile.role)
  const canCreate = can(profile.role, 'tasks.create')

  const projectOf = (id: string) => projects.find((p) => p.id === id)
  const clientNameOfProject = (id: string) => clients.find((c) => c.id === projectOf(id)?.clientId)?.name ?? '—'
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? '—'

  const closeForm = () => {
    setShowForm(false)
    setForm(emptyForm)
    if (params.get('new')) setParams({}, { replace: true })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data: Omit<Task, 'id'> = {
      projectId: form.projectId,
      title: form.title,
      description: form.description,
      assignedUserId: form.assignedUserId,
      assignedBy: form.assignedUserId ? profile.id : '',
      status: 'PENDING',
      priority: form.priority,
      dueDate: form.dueDate,
      createdAt: Date.now(),
      estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : 0,
      subtasks: [],
      comments: [],
    }
    await tasksService.create(data)
    if (form.assignedUserId && form.assignedUserId !== profile.id) {
      await notifyUser(form.assignedUserId, `Se te asignó la tarea "${form.title}"`, `Cliente: ${clientNameOfProject(form.projectId)}`)
    }
    closeForm()
  }

  const visible = tasks
    .filter((t) => !onlyMine || t.assignedUserId === profile.id)
    .filter((t) => !assignee || t.assignedUserId === assignee)
    .filter((t) => !search || t.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="module-page">
      <h1>Tablero de tareas</h1>
      <p className="page-subtitle">{onlyMine ? 'Las tareas que tienes asignadas' : 'Tareas del despacho por estado'}</p>

      <div className="toolbar">
        <input placeholder="Buscar tarea…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {!onlyMine && (
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Responsable: Todos</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        {canCreate && <button className="btn push-right" onClick={() => (showForm ? closeForm() : setShowForm(true))}>{showForm ? 'Cancelar' : '+ Nueva tarea'}</button>}
      </div>

      {showForm && canCreate && (
        <form className="inline-form form-grid" onSubmit={handleSubmit}>
          <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} required>
            <option value="">Proyecto…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name} — {clients.find((c) => c.id === p.clientId)?.name ?? ''}</option>)}
          </select>
          <input placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <select value={form.assignedUserId} onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}>
            <option value="">Responsable…</option>
            {users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
            {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>Prioridad {v.toLowerCase()}</option>)}
          </select>
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required />
          <input type="number" min="0" step="0.5" placeholder="Horas estimadas" value={form.estimatedHours} onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })} />
          <textarea className="span-all" placeholder="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button type="submit">Crear tarea</button>
        </form>
      )}

      {loading ? <p>Cargando…</p> : (
        <div className="board">
          {COLUMNS.map((col) => {
            const colTasks = visible.filter((t) => t.status === col)
            return (
              <div className="board-col" key={col}>
                <h3><span>{STATUS_LABEL[col]}</span><span>{colTasks.length}</span></h3>
                {colTasks.map((t) => {
                  const subs = t.subtasks ?? []
                  return (
                    <Link className="task-card" key={t.id} to={`${base}/tasks/${t.id}`}>
                      <div className="task-card-title">
                        <span>{t.title}</span>
                        <span className={'priority-pill priority-' + t.priority.toLowerCase()}>{PRIORITY_LABEL[t.priority]}</span>
                      </div>
                      <div className="task-card-meta">
                        <span>{clientNameOfProject(t.projectId)} · {projectOf(t.projectId)?.name ?? '—'}</span>
                        <span>{userName(t.assignedUserId)}</span>
                        <span className={isOverdue(t) ? 'overdue' : ''}>Vence {t.dueDate || '—'}{isOverdue(t) ? ' · vencida' : ''}</span>
                        {subs.length > 0 && <span>Subtareas {subs.filter((s) => s.done).length}/{subs.length}</span>}
                      </div>
                    </Link>
                  )
                })}
                {colTasks.length === 0 && <p className="module-note" style={{ margin: 0 }}>Sin tareas</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
