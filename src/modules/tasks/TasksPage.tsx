import React, { useEffect, useState } from 'react'
import { tasksService } from './tasksService'
import { projectsService } from '../projects/projectsService'
import { usersService } from '../users/usersService'
import { useAuth } from '../../hooks/useAuth'
import { Task, TaskStatus, TaskPriority, Project, AppUser } from '../../models'

const emptyForm = {
  projectId: '', title: '', description: '', assignedUserId: '',
  status: 'PENDING' as TaskStatus, priority: 'MEDIUM' as TaskPriority, dueDate: '',
}

const STATUS_LABEL: Record<TaskStatus, string> = { PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', COMPLETED: 'Completada' }
const PRIORITY_LABEL: Record<TaskPriority, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta' }

// onlyMine=true restringe la vista a las tareas asignadas al usuario en sesión (rol OPERATOR).
export default function TasksPage({ onlyMine = false }: { onlyMine?: boolean }) {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    const unsubT = tasksService.subscribe((items) => { setTasks(items); setLoading(false) })
    const unsubP = projectsService.subscribe(setProjects)
    const unsubU = usersService.subscribe(setUsers)
    return () => { unsubT(); unsubP(); unsubU() }
  }, [])

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? '—'
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? '—'

  const resetForm = () => { setForm(emptyForm); setEditingId(null) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId) await tasksService.update(editingId, form)
    else await tasksService.create({ ...form, createdAt: Date.now() })
    resetForm()
  }

  const handleEdit = (t: Task) => {
    setForm({ projectId: t.projectId, title: t.title, description: t.description, assignedUserId: t.assignedUserId, status: t.status, priority: t.priority, dueDate: t.dueDate })
    setEditingId(t.id)
  }

  const changeStatus = async (t: Task, status: TaskStatus) => {
    await tasksService.update(t.id, { status })
  }

  const visible = onlyMine && profile ? tasks.filter((t) => t.assignedUserId === profile.id) : tasks

  return (
    <div className="module-page">
      <h1>{onlyMine ? 'Mis tareas' : 'Tareas'}</h1>

      {!onlyMine && (
        <form className="inline-form form-grid" onSubmit={handleSubmit}>
          <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} required>
            <option value="">Proyecto…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <input placeholder="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select value={form.assignedUserId} onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}>
            <option value="">Responsable…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
            {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          <button type="submit">{editingId ? 'Guardar' : 'Crear tarea'}</button>
          {editingId && <button type="button" onClick={resetForm}>Cancelar</button>}
        </form>
      )}

      {loading ? <p>Cargando…</p> : (
        <table className="data-table">
          <thead><tr><th>Tarea</th><th>Proyecto</th><th>Responsable</th><th>Prioridad</th><th>Vence</th><th>Estado</th>{!onlyMine && <th></th>}</tr></thead>
          <tbody>
            {visible.map((t) => (
              <tr key={t.id}>
                <td>{t.title}<br /><small>{t.description}</small></td>
                <td>{projectName(t.projectId)}</td>
                <td>{userName(t.assignedUserId)}</td>
                <td><span className={'priority-pill priority-' + t.priority.toLowerCase()}>{PRIORITY_LABEL[t.priority]}</span></td>
                <td>{t.dueDate}</td>
                <td>
                  <select value={t.status} onChange={(e) => changeStatus(t, e.target.value as TaskStatus)}>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                {!onlyMine && <td className="row-actions"><button onClick={() => handleEdit(t)}>Editar</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
