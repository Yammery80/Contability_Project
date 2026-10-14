import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { where } from 'firebase/firestore'
import { tasksService } from './tasksService'
import { STATUS_LABEL, PRIORITY_LABEL, isOverdue } from './TasksPage'
import { projectsService } from '../projects/projectsService'
import { clientsService } from '../clients/clientsService'
import { timeEntriesService } from '../timeTracker/timeTrackerService'
import { useTimer } from '../timeTracker/useTimer'
import { useUsers } from '../users/useUsers'
import { useAuth, homeRouteForRole } from '../../hooks/useAuth'
import { notifyUser } from '../../services/notify'
import { formatClock, formatHours } from '../../services/billing'
import { initials, timeAgo } from '../../services/period'
import { Task, TaskStatus, TaskPriority, Project, Client, TimeEntry } from '../../models'

const newId = () => Math.random().toString(36).slice(2, 10)

export default function TaskDetailPage() {
  const { taskId = '' } = useParams()
  const { profile } = useAuth()
  const users = useUsers()
  const timer = useTimer()

  const [task, setTask] = useState<Task | null | undefined>(undefined) // undefined = cargando
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ title: '', description: '' })
  const [newSubtask, setNewSubtask] = useState('')
  const [commentText, setCommentText] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [manual, setManual] = useState({ date: '', from: '', to: '' })
  const [timerError, setTimerError] = useState<string | null>(null)

  useEffect(() => {
    const u1 = tasksService.subscribeOne(taskId, setTask)
    const u2 = projectsService.subscribe(setProjects)
    const u3 = clientsService.subscribe(setClients)
    return () => { u1(); u2(); u3() }
  }, [taskId])

  // El Operador solo puede leer sus propios registros de tiempo (reglas de Firestore).
  useEffect(() => {
    if (!profile) return
    const constraints = [where('taskId', '==', taskId), ...(profile.role === 'OPERATOR' ? [where('userId', '==', profile.id)] : [])]
    return timeEntriesService.subscribe(setEntries, constraints)
  }, [taskId, profile])

  const perPerson = useMemo(() => {
    const map = new Map<string, number>()
    entries.filter((e) => e.status === 'STOPPED').forEach((e) => map.set(e.userId, (map.get(e.userId) ?? 0) + e.duration))
    return [...map.entries()].map(([userId, seconds]) => ({ userId, seconds })).sort((a, b) => b.seconds - a.seconds)
  }, [entries])

  if (!profile) return null
  const base = homeRouteForRole(profile.role)
  const back = <Link className="back-link" to={`${base}/tasks`}>← Volver al tablero</Link>

  if (task === undefined) return <div className="module-page">{back}<p>Cargando…</p></div>
  if (task === null) return <div className="module-page">{back}<p>La tarea no existe o no tienes acceso a ella.</p></div>

  const isOperator = profile.role === 'OPERATOR'
  const project = projects.find((p) => p.id === task.projectId)
  const client = clients.find((c) => c.id === project?.clientId)
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? '—'
  const subtasks = task.subtasks ?? []
  const comments = task.comments ?? []
  const totalSeconds = perPerson.reduce((s, p) => s + p.seconds, 0)
  const maxSeconds = Math.max(1, ...perPerson.map((p) => p.seconds))

  const save = (patch: Partial<Task>) => tasksService.update(task.id, patch)

  const changeStatus = async (status: TaskStatus) => {
    await save({ status })
    if (status === 'COMPLETED' && project?.supervisorId && project.supervisorId !== profile.id) {
      await notifyUser(project.supervisorId, `La tarea "${task.title}" fue marcada como completada`, `${client?.name ?? ''} · por ${profile.name}`)
    }
  }

  const changeAssignee = async (userId: string) => {
    await save({ assignedUserId: userId, assignedBy: profile.id })
    if (userId && userId !== profile.id) {
      await notifyUser(userId, `Se te asignó la tarea "${task.title}"`, `Cliente: ${client?.name ?? '—'}`)
    }
  }

  const toggleSubtask = (id: string) => save({ subtasks: subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s)) })

  const addSubtask = async () => {
    const title = newSubtask.trim()
    if (!title) return
    await save({ subtasks: [...subtasks, { id: newId(), title, done: false }] })
    setNewSubtask('')
  }

  const addComment = async () => {
    const text = commentText.trim()
    if (!text) return
    await save({ comments: [...comments, { id: newId(), userId: profile.id, userName: profile.name, text, createdAt: Date.now() }] })
    setCommentText('')
    if (task.assignedUserId && task.assignedUserId !== profile.id) {
      await notifyUser(task.assignedUserId, `${profile.name} comentó en "${task.title}"`, text.slice(0, 120))
    }
  }

  const startEdit = () => { setDraft({ title: task.title, description: task.description }); setEditing(true) }
  const saveEdit = async () => { await save({ title: draft.title.trim() || task.title, description: draft.description }); setEditing(false) }

  const activity = { clientId: project?.clientId ?? '', projectId: task.projectId, taskId: task.id, description: task.title }
  const mine = timer.active?.taskId === task.id
  const otherActive = !!timer.active && !mine

  const handleStart = async () => setTimerError(await timer.start(activity))
  const handleManual = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = await timer.addManual(activity, manual.date, manual.from, manual.to)
    setTimerError(err)
    if (!err) { setManual({ date: '', from: '', to: '' }); setShowManual(false) }
  }

  const due = task.dueDate ? new Date(task.dueDate + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '') : 'sin fecha'

  return (
    <div className="module-page">
      {back}
      <div className="task-header">
        {editing
          ? <input className="field" style={{ fontSize: '1.2rem', fontWeight: 700, minWidth: 280 }} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          : <h1>{task.title}</h1>}
        <span className={'priority-pill priority-' + task.priority.toLowerCase()}>Prioridad {PRIORITY_LABEL[task.priority].toLowerCase()}</span>
      </div>
      <p className="page-subtitle">
        {client?.name ?? '—'} · Asignada a {userName(task.assignedUserId)} · <span className={isOverdue(task) ? 'overdue' : ''}>Vence {due}</span>
        {task.assignedBy && task.assignedBy !== task.assignedUserId && <> · Asignada por {userName(task.assignedBy)}</>}
      </p>

      <div className="task-layout">
        <div className="stack">
          <div className="timer-card">
            <div className="timer-label">{mine ? (timer.running ? 'Tiempo en curso' : 'Cronómetro en pausa') : 'Cronómetro'}</div>
            <div className="timer-display">{mine ? formatClock(timer.elapsed) : '00:00:00'}</div>
            <div className="timer-actions">
              {mine ? (
                <>
                  {timer.running
                    ? <button className="btn btn-ghost" onClick={timer.pause}>⏸ Pausar</button>
                    : <button className="btn btn-ghost" onClick={timer.resume}>▶ Reanudar</button>}
                  <button className="btn" onClick={timer.stop}>⏹ Detener</button>
                </>
              ) : (
                <button className="btn" onClick={handleStart} disabled={otherActive}>▶ Iniciar</button>
              )}
              <button className="btn btn-ghost" onClick={() => setShowManual((v) => !v)}>Registro manual</button>
            </div>
            {otherActive && <p className="timer-note">Tienes un cronómetro en curso en otra actividad. Detenlo para iniciar este.</p>}
            {timerError && <p className="timer-note" style={{ color: 'var(--danger)' }}>{timerError}</p>}
            {showManual && (
              <form className="manual-form" onSubmit={handleManual}>
                <input type="date" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} required />
                <input type="time" value={manual.from} onChange={(e) => setManual({ ...manual, from: e.target.value })} required />
                <input type="time" value={manual.to} onChange={(e) => setManual({ ...manual, to: e.target.value })} required />
                <button className="btn btn-sm" type="submit">Guardar</button>
              </form>
            )}
          </div>

          <div className="card">
            <h2>Descripción {!isOperator && !editing && <button className="btn btn-ghost btn-sm" onClick={startEdit}>Editar</button>}</h2>
            {editing ? (
              <>
                <textarea className="field" style={{ width: '100%', minHeight: 80 }} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                <div className="add-row"><button className="btn btn-sm" onClick={saveEdit}>Guardar</button><button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancelar</button></div>
              </>
            ) : (
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{task.description || <span className="muted">Sin descripción.</span>}</p>
            )}

            <h2 style={{ marginTop: '1.3rem' }}>Subtareas {subtasks.length > 0 && <small>{subtasks.filter((s) => s.done).length}/{subtasks.length}</small>}</h2>
            {subtasks.map((s) => (
              <label key={s.id} className={'subtask' + (s.done ? ' done' : '')}>
                <input type="checkbox" checked={s.done} onChange={() => toggleSubtask(s.id)} />
                <span>{s.title}</span>
              </label>
            ))}
            <div className="add-row">
              <input placeholder="Agregar subtarea…" value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSubtask()} />
              <button className="btn btn-sm" onClick={addSubtask}>Agregar</button>
            </div>
          </div>

          <div className="card">
            <h2>Comentarios</h2>
            {comments.length === 0 && <p className="module-note">Aún no hay comentarios.</p>}
            {comments.map((c) => (
              <div className="comment" key={c.id}>
                <div className="avatar avatar-sm">{initials(c.userName)}</div>
                <div className="comment-body"><strong>{c.userName}</strong><small>{timeAgo(c.createdAt)}</small><p>{c.text}</p></div>
              </div>
            ))}
            <div className="add-row">
              <textarea rows={2} placeholder="Escribe un comentario…" value={commentText} onChange={(e) => setCommentText(e.target.value)} />
              <button className="btn btn-sm" style={{ alignSelf: 'flex-end' }} onClick={addComment}>Comentar</button>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h2>Detalles</h2>
            <div className="detail-row">
              <label>Estado</label>
              <select value={task.status} onChange={(e) => changeStatus(e.target.value as TaskStatus)}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="detail-row">
              <label>Responsable</label>
              <select value={task.assignedUserId} disabled={isOperator} onChange={(e) => changeAssignee(e.target.value)}>
                <option value="">Sin asignar</option>
                {users.filter((u) => u.active || u.id === task.assignedUserId).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="detail-row"><label>Cliente</label><input value={client?.name ?? '—'} disabled /></div>
            <div className="detail-row">
              <label>Prioridad</label>
              <select value={task.priority} disabled={isOperator} onChange={(e) => save({ priority: e.target.value as TaskPriority })}>
                {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="detail-row">
              <label>Fecha límite</label>
              <input type="date" value={task.dueDate} disabled={isOperator} onChange={(e) => save({ dueDate: e.target.value })} />
            </div>
            <div className="detail-row" style={{ marginBottom: 0 }}>
              <label>Horas estimadas</label>
              <input type="number" min="0" step="0.5" value={task.estimatedHours ?? 0} disabled={isOperator} onChange={(e) => save({ estimatedHours: Number(e.target.value) })} />
            </div>
          </div>

          <div className="card">
            <h2>Tiempo registrado</h2>
            <div className="big-hours">{formatHours(totalSeconds)} {!!task.estimatedHours && <small>/ {task.estimatedHours} h est.</small>}</div>
            <div style={{ marginTop: '.8rem' }}>
              {perPerson.length === 0 && <p className="module-note">Aún no hay tiempo registrado.</p>}
              {perPerson.map((p) => (
                <div className="bar-row" key={p.userId} style={{ gridTemplateColumns: '80px 1fr 48px' }}>
                  <span className="bar-label">{userName(p.userId)}</span>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${(p.seconds / maxSeconds) * 100}%` }} /></div>
                  <span className="bar-value">{formatHours(p.seconds)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
