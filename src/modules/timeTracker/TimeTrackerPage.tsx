import React, { useEffect, useMemo, useState } from 'react'
import { where } from 'firebase/firestore'
import { timeEntriesService, startOfWeek } from './timeTrackerService'
import { useTimer } from './useTimer'
import ActivityPicker, { PickerValue } from './ActivityPicker'
import { clientsService } from '../clients/clientsService'
import { projectsService } from '../projects/projectsService'
import { tasksService } from '../tasks/tasksService'
import { useUsers } from '../users/useUsers'
import { useAuth } from '../../hooks/useAuth'
import { LEVEL_LABEL, entryLevel, formatHours, formatClock } from '../../services/billing'
import { entryDate } from '../../services/period'
import { Client, Project, Task, TimeEntry } from '../../models'

const WEEKLY_GOAL_SECONDS = 40 * 3600
const DAY = 86400000
const emptyPick: PickerValue = { clientId: '', projectId: '', taskId: '' }

function weekLabel(start: number): string {
  const a = new Date(start)
  const b = new Date(start + 6 * DAY)
  const mon = b.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')
  return `Semana del ${a.getDate()}–${b.getDate()} ${mon}`
}

function weekOptions(count = 10) {
  const first = startOfWeek()
  return Array.from({ length: count }, (_, i) => {
    const start = first - i * 7 * DAY
    return { value: String(start), label: weekLabel(start) }
  })
}

export default function TimeTrackerPage() {
  const { profile } = useAuth()
  const timer = useTimer()
  const users = useUsers()
  const [all, setAll] = useState<TimeEntry[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  const [week, setWeek] = useState(String(startOfWeek()))
  const [employee, setEmployee] = useState('')
  const [showManual, setShowManual] = useState(false)

  const [pick, setPick] = useState<PickerValue>(emptyPick)
  const [description, setDescription] = useState('')
  const [manual, setManual] = useState({ date: '', from: '', to: '' })
  const [error, setError] = useState<string | null>(null)

  const isOperator = profile?.role === 'OPERATOR'

  useEffect(() => {
    const u1 = clientsService.subscribe(setClients)
    const u2 = projectsService.subscribe(setProjects)
    const u3 = tasksService.subscribe(setTasks)
    return () => { u1(); u2(); u3() }
  }, [])

  // El Operador solo puede leer sus propios registros (reglas de Firestore).
  useEffect(() => {
    if (!profile) return
    return timeEntriesService.subscribe(setAll, isOperator ? [where('userId', '==', profile.id)] : [])
  }, [profile, isOperator])

  const rows = useMemo(() => {
    const start = Number(week)
    return all
      .filter((e) => e.status === 'STOPPED')
      .filter((e) => entryDate(e) >= start && entryDate(e) < start + 7 * DAY)
      .filter((e) => !employee || e.userId === employee)
      .sort((a, b) => entryDate(b) - entryDate(a))
  }, [all, week, employee])

  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? '—'
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? '—'
  const taskTitle = (id: string) => tasks.find((t) => t.id === id)?.title ?? '—'
  const ref = () => ({ ...pick, description })

  const handleStart = async () => {
    setError(null)
    setError(await timer.start(ref()))
    setDescription('')
  }

  const handleManual = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const err = await timer.addManual(ref(), manual.date, manual.from, manual.to)
    setError(err)
    if (!err) {
      setManual({ date: '', from: '', to: '' })
      setShowManual(false)
    }
  }

  const remaining = Math.max(0, WEEKLY_GOAL_SECONDS - timer.weekSeconds)
  const hm = (s: number) => `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`
  const activeTask = timer.active ? tasks.find((t) => t.id === timer.active!.taskId) : null

  return (
    <div className="module-page">
      <h1>Registro de tiempos</h1>
      <p className="page-subtitle">{isOperator ? 'Tu tiempo capturado' : 'Tiempo capturado por el equipo'} · vinculado a tarea y cliente</p>

      <div className="tracker-top">
        <div className="card">
          <h2>Mi semana <small>Meta 40 h</small></h2>
          <div className="weekly-row">
            <div><span className="label">Objetivo</span><span className="value">40 h</span></div>
            <div><span className="label">Registrado</span><span className="value">{hm(timer.weekSeconds)}</span></div>
            <div><span className="label">Restante</span><span className="value">{hm(remaining)}</span></div>
          </div>
          <div className="week-bar"><div className="week-bar-fill" style={{ width: `${Math.min(100, (timer.weekSeconds / WEEKLY_GOAL_SECONDS) * 100)}%` }} /></div>
        </div>

        <div className="card">
          <h2>Mi cronómetro</h2>
          {timer.active ? (
            <div style={{ textAlign: 'center' }}>
              <div className="timer-display" style={{ margin: '0 0 .3rem' }}>{formatClock(timer.elapsed)}</div>
              <div className="muted" style={{ fontSize: '.85rem', marginBottom: '.8rem' }}>
                {activeTask?.title ?? (timer.active.description || 'Sin descripción')}
                {timer.active.status === 'PAUSED' && ' · en pausa'}
              </div>
              <div className="timer-actions">
                {timer.running
                  ? <button className="btn btn-ghost" onClick={timer.pause}>⏸ Pausar</button>
                  : <button className="btn btn-ghost" onClick={timer.resume}>▶ Reanudar</button>}
                <button className="btn btn-danger" onClick={timer.stop}>⏹ Detener</button>
              </div>
            </div>
          ) : (
            <div className="inline-form form-grid" style={{ border: 'none', padding: 0, marginBottom: 0 }}>
              <ActivityPicker clients={clients} projects={projects} tasks={tasks} value={pick} onChange={setPick} />
              <input placeholder="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
              <button type="button" onClick={handleStart}>▶ Iniciar</button>
            </div>
          )}
          {error && <p className="form-error" style={{ marginTop: '.6rem' }}>{error}</p>}
        </div>
      </div>

      <div className="toolbar">
        <select value={week} onChange={(e) => setWeek(e.target.value)}>
          {weekOptions().map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
        {!isOperator && (
          <select value={employee} onChange={(e) => setEmployee(e.target.value)}>
            <option value="">Empleado: Todos</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <button className="btn push-right" onClick={() => setShowManual((v) => !v)}>+ Registrar tiempo</button>
      </div>

      {showManual && (
        <form className="inline-form form-grid" onSubmit={handleManual}>
          <ActivityPicker clients={clients} projects={projects} tasks={tasks} value={pick} onChange={setPick} />
          <input placeholder="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input type="date" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} required />
          <input type="time" value={manual.from} onChange={(e) => setManual({ ...manual, from: e.target.value })} required />
          <input type="time" value={manual.to} onChange={(e) => setManual({ ...manual, to: e.target.value })} required />
          <button type="submit">Guardar registro</button>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr><th>Fecha</th><th>Empleado</th><th>Cliente</th><th>Tarea</th><th>Tipo</th><th className="num">Horas</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={6} className="muted">Sin registros en esta semana.</td></tr>}
          {rows.map((e) => (
            <tr key={e.id}>
              <td>{new Date(entryDate(e)).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '')}</td>
              <td>{userName(e.userId)}</td>
              <td>{e.clientId ? clientName(e.clientId) : '—'}</td>
              <td>{e.taskId ? taskTitle(e.taskId) : (e.description || '—')}</td>
              <td><span className="pill neutral">{LEVEL_LABEL[entryLevel(e, users)]}</span></td>
              <td className="num">{formatHours(e.duration)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="footnote">Cada registro se asocia automáticamente al nivel del empleado (Junior / Senior / Administrador) para el cálculo del cobro estimado.</p>
    </div>
  )
}
