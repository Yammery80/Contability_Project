import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CalendarDays, CheckCircle2, Clock3 } from 'lucide-react'
import { tasksService } from './tasksService'
import { projectsService } from '../projects/projectsService'
import { clientsService } from '../clients/clientsService'
import { useUsers } from '../users/useUsers'
import { useAuth, homeRouteForRole } from '../../hooks/useAuth'
import { Task, TaskStatus, Project, Client } from '../../models'
import { STATUS_LABEL, PRIORITY_LABEL, isOverdue } from './TasksPage'
import './tasksPage.css'

const COLUMNS: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED']

export default function KanbanPage({ onlyMine = false }: { onlyMine?: boolean }) {
  const { profile } = useAuth()
  const users = useUsers()
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [assignee, setAssignee] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubTasks = tasksService.subscribe(items => {
      setTasks(items)
      setLoading(false)
    })
    const unsubProjects = projectsService.subscribe(setProjects)
    const unsubClients = clientsService.subscribe(setClients)

    return () => {
      unsubTasks()
      unsubProjects()
      unsubClients()
    }
  }, [])

  if (!profile) return null

  const base = homeRouteForRole(profile.role)
  const isOperator = profile.role === 'OPERATOR'

  const visible = tasks
    .filter(t => !onlyMine || t.assignedUserId === profile.id)
    .filter(t => !assignee || t.assignedUserId === assignee)
    .filter(t => t.title.toLowerCase().includes(search.trim().toLowerCase()))

  const projectOf = (id: string) => projects.find(p => p.id === id)
  const clientName = (id: string) =>
    clients.find(c => c.id === projectOf(id)?.clientId)?.name ?? '—'
  const userName = (id: string) =>
    users.find(u => u.id === id)?.name ?? 'Sin asignar'

  const moveTask = async (taskId: string, status: TaskStatus) => {
    if (busy) return

    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === status) return

    if (isOperator && task.assignedUserId !== profile.id) {
      setError('Solo puedes cambiar tus tareas asignadas.')
      return
    }

    setBusy(true)
    setError('')

    try {
      const patch: Partial<Task> = { status }

      if (status === 'COMPLETED') {
        const now = Date.now()

        patch.completedAt = now
        patch.completedBy = profile.id
        patch.completionHistory = [
          ...(task.completionHistory ?? []),
          {
            userId: profile.id,
            userName: profile.name,
            completedAt: now
          }
        ]
      } else if (task.status === 'COMPLETED') {
        // Se conserva el historial de finalizaciones.
        patch.completedAt = 0
        patch.completedBy = ''
      }

      await tasksService.update(task.id, patch)
    } catch (err) {
      console.error('Error al mover tarea:', err)
      setError(
        'No se pudo actualizar la tarea. ' +
        'Verifica los permisos de Firestore.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="module-page tasks-enhanced">
      <div className="tasks-heading">
        <div>
          <h1>Tablero Kanban</h1>
          <p className="page-subtitle">
            Organiza y consulta el avance de las tareas del despacho.
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

        <Link className="btn push-right" to={`${base}/tasks?new=1`}>
          + Nueva tarea
        </Link>
      </div>

      {error && (
        <div className="task-feedback" role="alert">
          {error}
          <button
            type="button"
            onClick={() => setError('')}
            style={{ marginLeft: 12 }}
          >
            Cerrar
          </button>
        </div>
      )}

      {loading ? (
        <p>Cargando tareas…</p>
      ) : (
        <div className="board">
          {COLUMNS.map(column => {
            const columnTasks = visible.filter(t => t.status === column)

            return (
              <div
                className="board-col"
                key={column}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  if (draggedId) void moveTask(draggedId, column)
                  setDraggedId(null)
                }}
              >
                <h3>
                  <span>{STATUS_LABEL[column]}</span>
                  <span>{columnTasks.length}</span>
                </h3>

                {columnTasks.map(task => {
                  const overdue = isOverdue(task)
                  const completed = task.status === 'COMPLETED'

                  return (
                    <div
                      key={task.id}
                      draggable={!busy}
                      onDragStart={e => {
                        e.dataTransfer.effectAllowed = 'move'
                        setDraggedId(task.id)
                      }}
                      onDragEnd={() => setDraggedId(null)}
                      style={{
                        cursor: busy ? 'wait' : 'grab',
                        opacity: draggedId === task.id ? 0.5 : 1
                      }}
                    >
                      <Link
                        className="task-card"
                        to={`${base}/tasks/${task.id}`}
                      >
                        <div className="task-card-title">
                          <span>{task.title}</span>
                          <span
                            className={`priority-pill priority-${(task.priority ?? 'MEDIUM').toLowerCase()}`}
                          >
                            {PRIORITY_LABEL[task.priority ?? 'MEDIUM']}
                          </span>
                        </div>

                        <div className="task-card-meta">
                          <span>
                            {clientName(task.projectId)} · {projectOf(task.projectId)?.name ?? '—'}
                          </span>
                          <span>{userName(task.assignedUserId)}</span>
                          <span className={overdue ? 'overdue' : ''}>
                            <CalendarDays size={13} />
                            Vence {task.dueDate || '—'}
                          </span>
                          {(task.subtasks ?? []).length > 0 && (
                            <span>
                              Subtareas {(task.subtasks ?? []).filter(s => s.done).length}/
                              {(task.subtasks ?? []).length}
                            </span>
                          )}
                        </div>

                        <div
                          className={`task-deadline task-deadline-${
                            completed ? 'completed' : overdue ? 'overdue' : 'safe'
                          }`}
                        >
                          {completed ? (
                            <CheckCircle2 size={14} />
                          ) : overdue ? (
                            <AlertCircle size={14} />
                          ) : (
                            <Clock3 size={14} />
                          )}
                          <span>
                            {completed
                              ? 'Completada'
                              : overdue
                                ? 'Vencida'
                                : `Vence ${task.dueDate || 'sin fecha'}`}
                          </span>
                        </div>
                      </Link>
                    </div>
                  )
                })}

                {columnTasks.length === 0 && (
                  <p className="module-note" style={{ margin: 0 }}>
                    Sin tareas
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
