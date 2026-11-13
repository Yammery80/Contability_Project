import { Link } from 'react-router-dom'
import { groupHours, historyRows, localDay, originLabel } from './timeHistory'
import { can } from '../../services/permissions'
import LateTimeInbox from './LateTimeInbox'
import LateTimeForm from './LateTimeForm'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { auth, db } from '../../firebase/config'
import { addDoc, collection, serverTimestamp, where } from 'firebase/firestore'
import { timeEntriesService, startOfWeek } from './timeTrackerService'
import { useTimer, isUnassigned } from './useTimer'
import StopTimerModal from './StopTimerModal'
import ActivityPicker, { PickerValue } from './ActivityPicker'
import { clientsService } from '../clients/clientsService'
import { projectsService } from '../projects/projectsService'
import { tasksService } from '../tasks/tasksService'
import { useUsers } from '../users/useUsers'
import { useAuth } from '../../hooks/useAuth'
import { LEVEL_LABEL, entryLevel, formatClock } from '../../services/billing'
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
  const weekEnd = (start: number) => {
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return localDay(end.getTime())
  }
  const [from, setFrom] = useState(() => localDay(Number(week)))
  const [to, setTo] = useState(() => weekEnd(Number(week)))
  const invalidPeriod = !from || !to || from > to
  const [employee, setEmployee] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [stopOpen, setStopOpen] = useState(false)

  const lateDialog = useRef<HTMLDialogElement>(null)
  const [latePick, setLatePick] = useState<PickerValue>(emptyPick)
  const [lateOpen, setLateOpen] = useState(false)

  const [pick, setPick] = useState<PickerValue>(emptyPick)
  const [description, setDescription] = useState('')
  const [sent, setSent] = useState(false)
  const [manualPick, setManualPick] = useState<PickerValue>(emptyPick)
  const [error, setError] = useState<string | null>(null)

  const [manual, setManual] = useState({ date: '', from: '', to: '' })
  const [manualDescription, setManualDescription] = useState('')
  const [manualError, setManualError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleManual(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    const userId = auth.currentUser?.uid
    if (!userId) return setManualError('Inicia sesión para solicitar el registro.')
    const startTime = new Date(manual.date + 'T' + manual.from).getTime()
    const endTime = new Date(manual.date + 'T' + manual.to).getTime()
    if (!(endTime > startTime) || endTime > Date.now()) return setManualError('Elige un intervalo válido que ya haya terminado.')
    setSubmitting(true)
    setManualError('')
    try {
      await addDoc(collection(db, 'lateTimeRequests'), {
        kind: 'STANDARD', requestedAt: serverTimestamp(), status: 'PENDING',
        entry: { ...manualPick, description: manualDescription.trim(), userId, startTime, endTime,
          duration: (endTime - startTime) / 1000, type: 'MANUAL', status: 'STOPPED' },
      })
      setManual({ date: '', from: '', to: '' })
      setManualPick(emptyPick)
      setManualDescription('')
      setShowManual(false)
      setSent(true)
    } catch {
      setManualError('No se pudo enviar la solicitud. Comprueba la conexión y los permisos.')
    } finally { setSubmitting(false) }
  }

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

  const team = can(profile?.role, 'team.view')
  const rows = useMemo(() => profile ? historyRows(all, from, to, team ? employee : profile.id) : [],
    [all, from, to, team, employee, profile])
  const groups = useMemo(() => groupHours(team ? rows : []), [team, rows])
  const userName = (id: string) => users.find(u => u.id === id)?.name || id
  const clientName = (id: string) => clients.find(c => c.id === id)?.name || (id ? 'Cliente ' + id : 'Sin cliente')
  const projectName = (id: string) => projects.find(p => p.id === id)?.name || (id ? 'Proyecto ' + id : 'Sin proyecto')
  const taskTitle = (id: string) => tasks.find(t => t.id === id)?.title || (id ? 'Tarea ' + id : 'Sin tarea')
  const ref = () => ({ ...pick, description })

  const handleStart = async () => {
    setError(null)
    setError(await timer.start(ref()))
    setDescription('')
  }



  const remaining = Math.max(0, WEEKLY_GOAL_SECONDS - timer.weekSeconds)
  const hm = (s: number) => `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`
  const activeTask = timer.active ? tasks.find((t) => t.id === timer.active!.taskId) : null

  return (
    <div className="module-page">
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1>Registro de tiempos</h1>
        <button className="btn btn-ghost" type="button" aria-haspopup="dialog" onClick={() => {
          setSent(false)
          setLatePick(emptyPick)
          setLateOpen(true)
          lateDialog.current?.showModal()
        }}>Solicitar registro extemporáneo</button>
      </header>
      <p className="page-subtitle">{isOperator ? 'Tu tiempo capturado' : 'Tiempo capturado por el equipo'} · vinculado a tarea y cliente</p>

      <dialog ref={lateDialog} aria-label="Solicitar registro extemporáneo"
        onClose={() => setLateOpen(false)}
        style={{ width: 'min(32rem, 92vw)', maxHeight: '90vh', padding: 0, border: 0, borderRadius: 12 }}>
        {lateOpen && <LateTimeForm title="Solicitar registro extemporáneo" onCancel={() => lateDialog.current?.close()}
          activity={{ ...latePick, description: '' }} onSent={() => {
            lateDialog.current?.close()
            setSent(true)
          }}>
          <ActivityPicker clients={clients} projects={projects} tasks={tasks} value={latePick} onChange={setLatePick} />
        </LateTimeForm>}
      </dialog>
      {sent && <p role="status">Solicitud enviada a revisión. Las horas se sumarán al aprobarla.</p>}

      {isOperator && <p><Link to="../expedientes">Consultar expediente de cliente</Link></p>}
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
                <button className="btn btn-danger" onClick={() => (isUnassigned(timer.active) ? setStopOpen(true) : timer.stop())}>⏹ Detener</button>
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

      {stopOpen && <StopTimerModal timer={timer} onClose={() => setStopOpen(false)} />}

      <div className="toolbar">
        <select aria-label="Periodo" value={week} onChange={e => {
          setWeek(e.target.value)
          if (e.target.value) {
            setFrom(localDay(Number(e.target.value)))
            setTo(weekEnd(Number(e.target.value)))
          }
        }}>
          <option value="">Rango personalizado</option>
          {weekOptions().map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
        <label>Desde <input type="date" value={from} onChange={e => { setWeek(''); setFrom(e.target.value) }} /></label>
        <label>Hasta <input type="date" value={to} onChange={e => { setWeek(''); setTo(e.target.value) }} /></label>
        {team && (
          <select aria-label="Colaborador" value={employee} onChange={(e) => setEmployee(e.target.value)}>
            <option value="">Empleado: Todos</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <button className="btn push-right" onClick={() => { setSent(false); setShowManual(v => !v) }}>+ Solicitar registro</button>
      </div>

      {showManual && (
        <form className="inline-form form-grid" onSubmit={handleManual}>
          <ActivityPicker clients={clients} projects={projects} tasks={tasks} value={manualPick} onChange={setManualPick} />
          <input maxLength={1000} placeholder="Descripción (opcional)" value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} />
          <input type="date" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} required />
          <input type="time" value={manual.from} onChange={(e) => setManual({ ...manual, from: e.target.value })} required />
          <input type="time" value={manual.to} onChange={(e) => setManual({ ...manual, to: e.target.value })} required />
          {manualError && <p role="alert">{manualError}</p>}
          <button disabled={submitting} type="submit">Solicitar registro</button>
        </form>
      )}

      {profile && <LateTimeInbox key={profile.id} profile={profile} users={users} tasks={tasks} />}
      {invalidPeriod && <p role="alert">Selecciona ambas fechas. La fecha final debe ser igual o posterior a la inicial.</p>}
      {team && !invalidPeriod && <section className="card">
        <h2>Horas por colaborador</h2>
        {Array.from(new Set([...users.filter(u => !employee || u.id === employee).map(u => u.id), ...groups.keys()]))
          .sort((a, b) => userName(a).localeCompare(userName(b), 'es'))
          .map(id => {
            const total = groups.get(id)
            if (!total) return <p key={id}>{userName(id)} · {formatClock(0)}</p>
            return <details key={id}>
              <summary>{userName(id)} · {formatClock(total.seconds)}</summary>
              <ul>{Array.from(total.children, ([client, c]) => <li key={client}>
                {clientName(client)} · {formatClock(c.seconds)}
                <ul>{Array.from(c.children, ([project, p]) => <li key={project}>
                  {projectName(project)} · {formatClock(p.seconds)}
                  <ul>{Array.from(p.children, ([task, t]) => <li key={task}>{taskTitle(task)} · {formatClock(t.seconds)}</li>)}</ul>
                </li>)}</ul>
              </li>)}</ul>
            </details>
          })}
      </section>}
      <h2>{team ? 'Historial de actividades del equipo' : 'Mi historial de actividades'}</h2>
      <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr><th>Fecha</th><th>Empleado</th><th>Cliente</th><th>Proyecto</th><th>Tarea</th><th>Origen</th><th>Nivel</th><th className="num">Duración (hh:mm:ss)</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={8} className="muted">Sin registros finalizados en el periodo.</td></tr>}
          {rows.map((e) => (
            <tr key={e.id}>
              <td>{new Date(entryDate(e)).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
              <td>{userName(e.userId)}</td>
              <td>{clientName(e.clientId)}</td>
              <td>{projectName(e.projectId)}</td>
              <td>{taskTitle(e.taskId)}{!e.taskId && e.description && ' · ' + e.description}</td>
              <td>{originLabel[e.type] || 'Sin clasificar'}</td>
              <td><span className="pill neutral">{LEVEL_LABEL[entryLevel(e, users)]}</span></td>
              <td className="num">{formatClock(e.duration)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <p className="footnote">Cada registro se asocia automáticamente al nivel del empleado (Junior / Senior / Administrador) para el cálculo del cobro estimado.</p>
    </div>
  )
}
