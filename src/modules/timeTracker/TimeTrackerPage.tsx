import React, { useEffect, useMemo, useState } from 'react'
import { where } from 'firebase/firestore'
import { timeEntriesService, formatDuration, formatHoursMinutes, startOfWeek } from './timeTrackerService'
import { clientsService } from '../clients/clientsService'
import { projectsService } from '../projects/projectsService'
import { tasksService } from '../tasks/tasksService'
import { useAuth } from '../../hooks/useAuth'
import { TimeEntry, Client, Project, Task } from '../../models'

const WEEKLY_GOAL_SECONDS = 40 * 3600

export default function TimeTrackerPage() {
  const { profile } = useAuth()
  const [active, setActive] = useState<TimeEntry | null>(null)
  const [now, setNow] = useState(Date.now())
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [taskId, setTaskId] = useState('')
  const [description, setDescription] = useState('')

  // Formulario de registro manual
  const [manual, setManual] = useState({ date: '', start: '', end: '', description: '' })

  useEffect(() => {
    const unsubC = clientsService.subscribe(setClients)
    const unsubP = projectsService.subscribe(setProjects)
    const unsubT = tasksService.subscribe(setTasks)
    return () => { unsubC(); unsubP(); unsubT() }
  }, [])

  // Suscripción a las entradas del usuario: permite reconstruir el timer activo
  // (persistido en Firestore) y calcular el resumen semanal aunque se haya
  // cerrado el navegador.
  useEffect(() => {
    if (!profile) return
    const unsub = timeEntriesService.subscribe(
      (items) => {
        setEntries(items)
        const running = items.find((e) => e.status === 'RUNNING') ?? null
        setActive(running)
      },
      [where('userId', '==', profile.id)]
    )
    return unsub
  }, [profile])

  // Tick del cronómetro visual (no depende de este estado para calcular el
  // tiempo real: startTime viene de Firestore).
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])

  const liveElapsedSeconds = useMemo(() => {
    if (!active || !active.startTime) return active?.duration ?? 0
    return active.duration + Math.floor((now - active.startTime) / 1000)
  }, [active, now])

  const weekTotalSeconds = useMemo(() => {
    const weekStart = startOfWeek()
    return entries
      .filter((e) => e.status !== 'RUNNING' && (e.endTime ?? 0) >= weekStart)
      .reduce((sum, e) => sum + e.duration, 0)
      + (active && active.startTime ? Math.floor((now - active.startTime) / 1000) + active.duration : 0)
  }, [entries, active, now])

  const remainingSeconds = Math.max(0, WEEKLY_GOAL_SECONDS - weekTotalSeconds)

  const handleStart = async () => {
    if (!profile) return
    await timeEntriesService.create({
      userId: profile.id,
      clientId, projectId, taskId, description,
      startTime: Date.now(),
      endTime: null,
      duration: 0,
      type: 'TIMER',
      status: 'RUNNING',
    })
  }

  const handlePause = async () => {
    if (!active) return
    const elapsed = active.duration + (active.startTime ? Math.floor((now - active.startTime) / 1000) : 0)
    await timeEntriesService.update(active.id, { duration: elapsed, startTime: null, status: 'PAUSED' })
  }

  const handleResume = async () => {
    if (!active) return
    await timeEntriesService.update(active.id, { startTime: Date.now(), status: 'RUNNING' })
  }

  const handleStop = async () => {
    if (!active) return
    const elapsed = active.duration + (active.startTime ? Math.floor((now - active.startTime) / 1000) : 0)
    await timeEntriesService.update(active.id, { duration: elapsed, startTime: null, endTime: Date.now(), status: 'STOPPED' })
    setDescription('')
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !manual.date || !manual.start || !manual.end) return
    const start = new Date(`${manual.date}T${manual.start}`).getTime()
    const end = new Date(`${manual.date}T${manual.end}`).getTime()
    if (end <= start) return
    await timeEntriesService.create({
      userId: profile.id,
      clientId, projectId, taskId,
      description: manual.description,
      startTime: start,
      endTime: end,
      duration: Math.floor((end - start) / 1000),
      type: 'MANUAL',
      status: 'STOPPED',
    })
    setManual({ date: '', start: '', end: '', description: '' })
  }

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? '—'
  const recent = entries.filter((e) => e.status === 'STOPPED').sort((a, b) => (b.endTime ?? 0) - (a.endTime ?? 0)).slice(0, 15)

  return (
    <div className="module-page">
      <h1>Time Tracker</h1>

      <div className="weekly-summary">
        <div><span className="label">Objetivo</span><span className="value">40 h</span></div>
        <div><span className="label">Registrado</span><span className="value">{formatHoursMinutes(weekTotalSeconds)}</span></div>
        <div><span className="label">Restante</span><span className="value">{formatHoursMinutes(remainingSeconds)}</span></div>
        <div className="week-bar"><div className="week-bar-fill" style={{ width: `${Math.min(100, (weekTotalSeconds / WEEKLY_GOAL_SECONDS) * 100)}%` }} /></div>
      </div>

      <div className="timer-card">
        {!active ? (
          <>
            <div className="form-grid">
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Cliente…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Proyecto…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                <option value="">Tarea…</option>
                {tasks.filter((t) => !projectId || t.projectId === projectId).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              <input placeholder="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <button className="timer-start" onClick={handleStart}>▶ Iniciar</button>
          </>
        ) : (
          <>
            <div className="timer-display">{formatDuration(liveElapsedSeconds)}</div>
            <div className="timer-meta">{projectName(active.projectId)} — {active.description || 'Sin descripción'}</div>
            <div className="timer-actions">
              {active.status === 'RUNNING' ? (
                <button onClick={handlePause}>⏸ Pausar</button>
              ) : (
                <button onClick={handleResume}>▶ Reanudar</button>
              )}
              <button className="timer-stop" onClick={handleStop}>⏹ Detener</button>
            </div>
          </>
        )}
      </div>

      <h2>Registro manual</h2>
      <form className="inline-form form-grid" onSubmit={handleManualSubmit}>
        <input type="date" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} required />
        <input type="time" value={manual.start} onChange={(e) => setManual({ ...manual, start: e.target.value })} required />
        <input type="time" value={manual.end} onChange={(e) => setManual({ ...manual, end: e.target.value })} required />
        <input placeholder="Descripción" value={manual.description} onChange={(e) => setManual({ ...manual, description: e.target.value })} />
        <button type="submit">Agregar registro</button>
      </form>

      <h2>Historial reciente</h2>
      <table className="data-table">
        <thead><tr><th>Proyecto</th><th>Descripción</th><th>Duración</th><th>Tipo</th><th>Fecha</th></tr></thead>
        <tbody>
          {recent.map((e) => (
            <tr key={e.id}>
              <td>{projectName(e.projectId)}</td>
              <td>{e.description}</td>
              <td>{formatDuration(e.duration)}</td>
              <td>{e.type === 'TIMER' ? 'Cronómetro' : 'Manual'}</td>
              <td>{e.endTime ? new Date(e.endTime).toLocaleDateString() : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
