import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertCircle, CalendarDays, CheckCircle2,
  Clock3, Plus, X
} from 'lucide-react'
import { tasksService } from './tasksService'
import { projectsService } from '../projects/projectsService'
import { clientsService } from '../clients/clientsService'
import { useUsers } from '../users/useUsers'
import { useAuth, homeRouteForRole } from '../../hooks/useAuth'
import { can } from '../../services/permissions'
import {
  Task, TaskStatus, TaskPriority, Project, Client
} from '../../models'
import './tasksPage.css'

export const STATUS_LABEL: Record<TaskStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada'
}

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta'
}

const COLUMNS: TaskStatus[] = [
  'PENDING', 'IN_PROGRESS', 'COMPLETED'
]

const emptyForm = {
  projectId: '',
  title: '',
  description: '',
  assignedUserId: '',
  priority: 'MEDIUM' as TaskPriority,
  dueDate: '',
  estimatedHours: ''
}

type FormErrors = Partial<Record<keyof typeof emptyForm, string>>

function localToday() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isOverdue(t: Task): boolean {
  return t.status !== 'COMPLETED' &&
    !!t.dueDate &&
    t.dueDate < localToday()
}

function getTrafficLight(t: Task) {
  if (t.status === 'COMPLETED') {
    return { label: 'Completada', level: 'completed' }
  }

  if (!t.dueDate) {
    return { label: 'Sin fecha', level: 'neutral' }
  }

  const today = localToday()
  const parseUTC = (value: string) =>
    Date.parse(`${value}T00:00:00Z`)

  const days = Math.round(
    (parseUTC(t.dueDate) - parseUTC(today)) / 86400000
  )

  if (days < 0) {
    return { label: 'Vencida', level: 'overdue' }
  }

  if (days <= 3) {
    return {
      label: days === 0 ? 'Vence hoy' : `${days} días restantes`,
      level: 'danger'
    }
  }

  if (days <= 7) {
    return { label: `${days} días restantes`, level: 'warning' }
  }

  return { label: `${days} días restantes`, level: 'safe' }
}

export default function TasksPage({
  onlyMine = false
}: {
  onlyMine?: boolean
}) {
  const { profile } = useAuth()
  const users = useUsers()
  const [params, setParams] = useSearchParams()

  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({ ...emptyForm })
  const [showForm, setShowForm] = useState(
    params.get('new') === '1'
  )
  const [search, setSearch] = useState('')
  const [assignee, setAssignee] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    const unsubscribeTasks = tasksService.subscribe(items => {
      setTasks(items)
      setLoading(false)
    })
    const unsubscribeProjects = projectsService.subscribe(setProjects)
    const unsubscribeClients = clientsService.subscribe(setClients)

    return () => {
      unsubscribeTasks()
      unsubscribeProjects()
      unsubscribeClients()
    }
  }, [])

  useEffect(() => {
    if (params.get('new') === '1') setShowForm(true)
  }, [params])

  if (!profile) return null

  const base = homeRouteForRole(profile.role)
  const canCreate = can(profile.role, 'tasks.create')

  const projectOf = (id: string) =>
    projects.find(p => p.id === id)

  const clientNameOfProject = (id: string) =>
    clients.find(c => c.id === projectOf(id)?.clientId)?.name ?? '—'

  const userName = (id: string) =>
    users.find(u => u.id === id)?.name ?? 'Sin asignar'

  const updateForm = <K extends keyof typeof emptyForm>(
    field: K,
    value: (typeof emptyForm)[K]
  ) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const closeForm = () => {
    if (saving) return
    setShowForm(false)
    setForm({ ...emptyForm })
    setErrors({})

    if (params.get('new')) {
      const next = new URLSearchParams(params)
      next.delete('new')
      setParams(next, { replace: true })
    }
  }

  const validate = () => {
    const next: FormErrors = {}

    if (!form.projectId) next.projectId = 'Selecciona un proyecto.'
    if (!form.title.trim()) next.title = 'Ingresa el título de la tarea.'
    else if (form.title.trim().length < 3)
      next.title = 'El título debe tener al menos 3 caracteres.'

    if (!form.dueDate) next.dueDate = 'Selecciona una fecha límite.'
    else if (form.dueDate < localToday())
      next.dueDate = 'La fecha no puede ser anterior a hoy.'

    if (
      form.estimatedHours !== '' &&
      (!Number.isFinite(Number(form.estimatedHours)) ||
        Number(form.estimatedHours) < 0)
    ) {
      next.estimatedHours = 'Ingresa una cantidad válida de horas.'
    }

    if (
      form.assignedUserId &&
      !users.some(u => u.id === form.assignedUserId && u.active)
    ) {
      next.assignedUserId = 'Selecciona un usuario activo.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || !canCreate || !validate()) return

    setSaving(true)
    setFeedback('')

    const data: Omit<Task, 'id'> = {
      projectId: form.projectId,
      title: form.title.trim(),
      description: form.description.trim(),
      assignedUserId: form.assignedUserId,
      assignedBy: form.assignedUserId ? profile.id : '',
      status: 'PENDING',
      priority: form.priority,
      dueDate: form.dueDate,
      createdAt: Date.now(),
      estimatedHours: Number(form.estimatedHours || 0),
      subtasks: [],
      comments: []
    }

    try {
      await tasksService.create(data)
    } catch (error) {
      console.error('Error al crear tarea:', error)
      setFeedback('No se pudo guardar la tarea. Verifica tu conexión y permisos.')
      setSaving(false)
      return
    }

    setSaving(false)
    closeForm()
  }

  const visible = tasks
    .filter(t => !onlyMine || t.assignedUserId === profile.id)
    .filter(t => !assignee || t.assignedUserId === assignee)
    .filter(t => t.title.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="module-page tasks-enhanced">
      <div className="tasks-heading">
        <div>
          <h1>Tablero de tareas</h1>
          <p className="page-subtitle">
            {onlyMine
              ? 'Las tareas que tienes asignadas'
              : 'Gestiona y supervisa las tareas del despacho'}
          </p>
        </div>
      </div>

      <div className="toolbar">
        <input
          aria-label="Buscar tareas"
          placeholder="Buscar tarea…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {!onlyMine && (
          <select
            aria-label="Filtrar por responsable"
            value={assignee}
            onChange={e => setAssignee(e.target.value)}
          >
            <option value="">Responsable: Todos</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}

        {canCreate && (
          <button
            type="button"
            className="btn push-right"
            disabled={saving}
            onClick={() => showForm ? closeForm() : setShowForm(true)}
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancelar' : 'Nueva tarea'}
          </button>
        )}
      </div>

      {feedback && (
        <div className="task-feedback" role="status">{feedback}</div>
      )}

      {showForm && canCreate && (
        <form className="task-create-panel" onSubmit={handleSubmit} noValidate>
          <div className="task-form-heading">
            <div>
              <h2>Nueva tarea</h2>
              <p>Completa la información para registrar una tarea.</p>
            </div>
            <button
              type="button"
              className="task-close"
              onClick={closeForm}
              disabled={saving}
              aria-label="Cerrar formulario"
            >
              <X size={20} />
            </button>
          </div>

          <div className="task-form-fields">
            <div className="task-field">
              <label htmlFor="task-project">Proyecto *</label>
              <select
                id="task-project"
                value={form.projectId}
                aria-invalid={!!errors.projectId}
                onChange={e => updateForm('projectId', e.target.value)}
              >
                <option value="">Seleccionar proyecto</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {clients.find(c => c.id === p.clientId)?.name ?? ''}
                  </option>
                ))}
              </select>
              {errors.projectId && <small className="task-error">{errors.projectId}</small>}
            </div>

            <div className="task-field">
              <label htmlFor="task-assignee">Responsable</label>
              <select
                id="task-assignee"
                value={form.assignedUserId}
                aria-invalid={!!errors.assignedUserId}
                onChange={e => updateForm('assignedUserId', e.target.value)}
              >
                <option value="">Sin asignar</option>
                {users.filter(u => u.active).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              {errors.assignedUserId && <small className="task-error">{errors.assignedUserId}</small>}
            </div>

            <div className="task-field task-full">
              <label htmlFor="task-title">Título de la tarea *</label>
              <input
                id="task-title"
                maxLength={120}
                placeholder="Ej. Preparar declaración mensual"
                value={form.title}
                aria-invalid={!!errors.title}
                onChange={e => updateForm('title', e.target.value)}
              />
              {errors.title && <small className="task-error">{errors.title}</small>}
            </div>

            <div className="task-field task-full">
              <label>Prioridad de la tarea</label>
              <div className="task-priority-options">
                {(['LOW', 'MEDIUM', 'HIGH'] as TaskPriority[]).map(priority => (
                  <button
                    key={priority}
                    type="button"
                    aria-pressed={form.priority === priority}
                    className={`task-priority-choice task-priority-${priority.toLowerCase()} ${form.priority === priority ? 'selected' : ''}`}
                    onClick={() => updateForm('priority', priority)}
                  >
                    <span className="task-priority-dot" />
                    {PRIORITY_LABEL[priority]}
                    {form.priority === priority && <CheckCircle2 size={15} />}
                  </button>
                ))}
              </div>
              <small className="task-help">
                La prioridad indica la importancia de la tarea, no su vencimiento.
              </small>
            </div>

            <div className="task-field">
              <label htmlFor="task-due">Fecha límite *</label>
              <input
                id="task-due"
                type="date"
                min={localToday()}
                value={form.dueDate}
                aria-invalid={!!errors.dueDate}
                onChange={e => updateForm('dueDate', e.target.value)}
              />
              {errors.dueDate && <small className="task-error">{errors.dueDate}</small>}
            </div>

            <div className="task-field">
              <label htmlFor="task-hours">Horas estimadas</label>
              <input
                id="task-hours"
                type="number"
                min="0"
                step="0.5"
                placeholder="Ej. 4"
                value={form.estimatedHours}
                aria-invalid={!!errors.estimatedHours}
                onChange={e => updateForm('estimatedHours', e.target.value)}
              />
              {errors.estimatedHours && <small className="task-error">{errors.estimatedHours}</small>}
            </div>

            <div className="task-field task-full">
              <label htmlFor="task-description">Descripción</label>
              <textarea
                id="task-description"
                rows={4}
                placeholder="Describe las actividades que deben realizarse..."
                value={form.description}
                onChange={e => updateForm('description', e.target.value)}
              />
            </div>
          </div>

          <div className="task-form-footer">
            <span>* Campos obligatorios</span>
            <div className="task-form-actions">
              <button
                type="button"
                className="task-secondary-btn"
                onClick={closeForm}
                disabled={saving}
              >
                Cancelar
              </button>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? 'Guardando…' : 'Crear tarea'}
              </button>
            </div>
          </div>
        </form>
      )}


      {loading ? (
        <p>Cargando tareas…</p>
      ) : (
        <div className="task-create-panel">
          <div className="task-form-heading">
            <div>
              <h2>Listado de tareas</h2>
              <p>Consulta las tareas registradas y abre una para ver sus detalles.</p>
            </div>
            <span>{visible.length} tareas</span>
          </div>

          <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
            {visible.map(t => {
              const traffic = getTrafficLight(t)

              return (
                <Link
                  key={t.id}
                  to={`${base}/tasks/${t.id}`}
                  className="task-card"
                >
                  <div className="task-card-title">
                    <span>{t.title}</span>
                    <span className={`priority-pill priority-${(t.priority ?? 'MEDIUM').toLowerCase()}`}>
                      {PRIORITY_LABEL[t.priority ?? 'MEDIUM']}
                    </span>
                  </div>

                  <div className="task-card-meta">
                    <span>{clientNameOfProject(t.projectId)} · {projectOf(t.projectId)?.name ?? '—'}</span>
                    <span>Responsable: {userName(t.assignedUserId)}</span>
                    <span><CalendarDays size={13} /> Vence {t.dueDate || '—'}</span>
                    <span>Estado: {STATUS_LABEL[t.status]}</span>
                  </div>

                  <div className={`task-deadline task-deadline-${traffic.level}`}>
                    {traffic.level === 'overdue' || traffic.level === 'danger'
                      ? <AlertCircle size={14} />
                      : traffic.level === 'completed'
                        ? <CheckCircle2 size={14} />
                        : <Clock3 size={14} />}
                    <span>{traffic.label}</span>
                  </div>
                </Link>
              )
            })}

            {visible.length === 0 && (
              <p className="module-note">No hay tareas que coincidan con los filtros.</p>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
