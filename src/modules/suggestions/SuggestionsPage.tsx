import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { where } from 'firebase/firestore'
import { timeSuggestionsService } from './timeSuggestionsService'
import { approveSuggestion, rejectSuggestion } from './suggestionActions'
import { applyEdit, validateAssignment, validateEdit } from './editSuggestion'
import { activitiesService } from '../activities/activitiesService'
import { trackedAppsService } from '../activities/trackedAppsService'
import { appNameOf } from '../activities/appName'
import { fmtDur, fmtTime, todayStr } from '../activities/format'
import ActivityPicker, { PickerValue } from '../timeTracker/ActivityPicker'
import { clientsService } from '../clients/clientsService'
import { projectsService } from '../projects/projectsService'
import { tasksService } from '../tasks/tasksService'
import { useAuth, homeRouteForRole } from '../../hooks/useAuth'
import { Activity, Client, Project, SuggestionStatus, Task, TimeSuggestion, TrackedApp } from '../../models'

const STATUS_LABEL: Record<SuggestionStatus, string> = { PENDING: 'Pendiente', APPROVED: 'Aprobada', DISCARDED: 'Rechazada' }
const STATUS_PILL: Record<SuggestionStatus, string> = { PENDING: 'warn', APPROVED: 'ok', DISCARDED: 'off' }
const TABS: SuggestionStatus[] = ['PENDING', 'APPROVED', 'DISCARDED']
const TAB_LABEL: Record<SuggestionStatus, string> = { PENDING: 'Pendientes', APPROVED: 'Aprobadas', DISCARDED: 'Rechazadas' }

const dateStr = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

interface Notice { text: string; to?: string; label?: string }
interface Lists { activities: Map<string, Activity>; apps: TrackedApp[]; clients: Client[]; projects: Project[]; tasks: Task[] }

export default function SuggestionsPage() {
  const { profile } = useAuth()
  const [suggestions, setSuggestions] = useState<TimeSuggestion[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [apps, setApps] = useState<TrackedApp[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<SuggestionStatus>('PENDING')
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    const u1 = trackedAppsService.subscribe(setApps)
    const u2 = clientsService.subscribe(setClients)
    const u3 = projectsService.subscribe(setProjects)
    const u4 = tasksService.subscribe(setTasks)
    return () => { u1(); u2(); u3(); u4() }
  }, [])
  useEffect(() => {
    if (!profile) return
    const u1 = timeSuggestionsService.subscribe((items) => { setSuggestions(items); setLoading(false) }, [where('userId', '==', profile.id)])
    const u2 = activitiesService.subscribe(setActivities, [where('userId', '==', profile.id)])
    return () => { u1(); u2() }
  }, [profile])

  const lists: Lists = useMemo(() => ({ activities: new Map(activities.map((a) => [a.id, a])), apps, clients, projects, tasks }), [activities, apps, clients, projects, tasks])
  const base = profile ? homeRouteForRole(profile.role) : ''
  const byStatus = (st: SuggestionStatus) => suggestions.filter((s) => s.status === st)
  const visible = useMemo(() => byStatus(tab).sort((a, b) => b.startTime - a.startTime), [suggestions, tab]) // eslint-disable-line react-hooks/exhaustive-deps
  const sumSeconds = (st: SuggestionStatus) => byStatus(st).reduce((n, s) => n + s.duration, 0)

  return (
    <div className="module-page">
      <h1>Sugerencias de horas</h1>
      <p className="page-subtitle">Bloques de trabajo armados con lo que capturó la extensión · solo tú ves las tuyas</p>

      {notice && (
        <div className="alert alert-success">
          {notice.text} {notice.to && <Link to={notice.to}>{notice.label}</Link>}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card"><span className="stat-label">Pendientes de revisar</span><span className="stat-value">{byStatus('PENDING').length}</span><span className="stat-sub">{fmtDur(sumSeconds('PENDING'))}</span></div>
        <div className="stat-card"><span className="stat-label">Aprobadas</span><span className="stat-value">{byStatus('APPROVED').length}</span><span className="stat-sub">{fmtDur(sumSeconds('APPROVED'))} registradas</span></div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={'tab' + (tab === t ? ' active' : '')} onClick={() => { setTab(t); setNotice(null) }}>
            {TAB_LABEL[t]} ({byStatus(t).length})
          </button>
        ))}
      </div>

      {loading ? <p>Cargando…</p> : visible.length === 0 ? (
        <div className="empty-state">
          {tab === 'PENDING'
            ? <>Aún no tienes sugerencias pendientes. Ve al <Link to={`${base}/activities`}>Historial de actividades</Link> y usa «Sugerir horas del día» o selecciona actividades.</>
            : tab === 'APPROVED' ? 'Todavía no has aprobado ninguna sugerencia.' : 'No has rechazado ninguna sugerencia.'}
        </div>
      ) : (
        <div className="stack">
          {visible.map((s) => <SuggestionCard key={s.id} s={s} lists={lists} base={base} onNotice={setNotice} />)}
        </div>
      )}
    </div>
  )
}

function SuggestionCard({ s, lists, base, onNotice }: { s: TimeSuggestion; lists: Lists; base: string; onNotice: (n: Notice | null) => void }) {
  const [mode, setMode] = useState<'view' | 'edit' | 'reject'>('view')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const acts = s.activityIds.map((id) => lists.activities.get(id)).filter((a): a is Activity => !!a).sort((a, b) => a.startTime - b.startTime)
  const names = [...new Set(acts.map((a) => appNameOf(a.domain, lists.apps)))]
  const client = lists.clients.find((c) => c.id === s.clientId)
  const project = lists.projects.find((p) => p.id === s.projectId)
  const task = lists.tasks.find((t) => t.id === s.taskId)
  const pending = s.status === 'PENDING'

  // ---------- editar (HU-62) ----------
  const [pick, setPick] = useState<PickerValue>({ clientId: s.clientId, projectId: s.projectId, taskId: s.taskId })
  const [description, setDescription] = useState(s.description)
  const [date, setDate] = useState(dateStr(s.startTime))
  const [hours, setHours] = useState(Math.floor(s.duration / 3600))
  const [minutes, setMinutes] = useState(Math.round((s.duration % 3600) / 60))

  const openEdit = () => {
    setPick({ clientId: s.clientId, projectId: s.projectId, taskId: s.taskId }); setDescription(s.description)
    setDate(dateStr(s.startTime)); setHours(Math.floor(s.duration / 3600)); setMinutes(Math.round((s.duration % 3600) / 60))
    setError(null); setMode('edit')
  }

  const save = async () => {
    const values = { ...pick, description, date, hours, minutes }
    const problem = validateEdit(values, todayStr()) ?? validateAssignment(pick, lists.projects, lists.tasks)
    if (problem) return setError(problem)
    setBusy(true); setError(null)
    try {
      await timeSuggestionsService.update(s.id, applyEdit(s, values))   // no toca las actividades de origen
      setMode('view')
    } catch { setError('No se pudieron guardar los cambios.') } finally { setBusy(false) }
  }

  // ---------- aprobar y rechazar (HU-65) ----------
  const approve = async () => {
    if (!s.clientId && !window.confirm('Esta sugerencia no tiene cliente. ¿Aprobarla como trabajo interno, sin cliente?')) return
    setBusy(true); setError(null)
    try {
      await approveSuggestion(s.id)
      onNotice({ text: `Aprobada: se registraron ${fmtDur(s.duration)} en «Registro de tiempos».`, to: `${base}/time-tracker`, label: 'Ver registro de tiempos' })
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo aprobar.') } finally { setBusy(false) }
  }

  const [reason, setReason] = useState('')
  const reject = async () => {
    setBusy(true); setError(null)
    try {
      await rejectSuggestion(s.id, reason)
      onNotice({ text: 'Sugerencia rechazada. Sus actividades no se volverán a sugerir solas.' })
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo rechazar.') } finally { setBusy(false) }
  }

  // Eliminar deshace la sugerencia: sus actividades vuelven a estar disponibles en el historial.
  const remove = async () => {
    if (window.confirm('¿Eliminar esta sugerencia? Sus actividades volverán a estar disponibles en el historial.')) {
      await timeSuggestionsService.remove(s.id)
    }
  }

  return (
    <div className="card suggestion-card">
      <div className="suggestion-head">
        <div>
          <strong>{new Date(s.startTime).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
          <span className="muted"> · {fmtTime(s.startTime)} – {fmtTime(s.endTime)}</span>
        </div>
        <div className="suggestion-total">{fmtDur(s.duration)}</div>
      </div>
      <div className="chips-row" style={{ margin: '.5rem 0' }}>
        <span className={'pill ' + STATUS_PILL[s.status]}>{STATUS_LABEL[s.status]}</span>
        {names.map((n) => <span key={n} className="chip-btn" style={{ cursor: 'default' }}>{n}</span>)}
      </div>

      {mode === 'edit' ? (
        <div className="suggestion-edit">
          <div className="inline-form form-grid" style={{ border: 'none', padding: 0, marginBottom: '.6rem' }}>
            <ActivityPicker clients={lists.clients} projects={lists.projects} tasks={lists.tasks} value={pick} onChange={setPick} />
          </div>
          <label className="form-field"><span>Descripción</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="form-grid" style={{ marginTop: '.6rem' }}>
            <label className="form-field"><span>Fecha</span>
              <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="form-field"><span>Horas</span>
              <input type="number" min={0} max={24} value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label="Horas" />
            </label>
            <label className="form-field"><span>Minutos</span>
              <input type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label="Minutos" />
            </label>
          </div>
          {error && <div className="alert alert-error" style={{ marginTop: '.7rem' }}>{error}</div>}
          <div className="suggestion-actions">
            <button className="btn btn-sm" disabled={busy} onClick={save}>Guardar cambios</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setMode('view')}>Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          <p className="module-note" style={{ margin: '.2rem 0' }}>
            Cliente: <strong>{client?.name ?? 'por asignar'}</strong>
            {project && <> · Proyecto: <strong>{project.name}</strong></>}
            {task && <> · Tarea: <strong>{task.title}</strong></>}
            {' '}· {s.activityIds.length} actividad(es)
          </p>
          {s.description && <p style={{ margin: '.2rem 0', fontSize: '.9rem' }}>{s.description}</p>}
          {s.status === 'DISCARDED' && <p className="module-note" style={{ margin: '.2rem 0' }}>Motivo del rechazo: <em>{s.rejectReason}</em></p>}
          {s.status === 'APPROVED' && <p className="module-note" style={{ margin: '.2rem 0' }}>Ya forma parte de tu <Link to={`${base}/time-tracker`}>registro de tiempos</Link>.</p>}
        </>
      )}

      {mode === 'reject' && (
        <div className="suggestion-edit" style={{ marginTop: '.6rem' }}>
          <label className="form-field"><span>Motivo del rechazo</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. fue trabajo personal" />
          </label>
          {error && <div className="alert alert-error" style={{ marginTop: '.7rem' }}>{error}</div>}
          <div className="suggestion-actions">
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={reject}>Rechazar sugerencia</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setMode('view'); setError(null) }}>Cancelar</button>
          </div>
        </div>
      )}

      <details>
        <summary>Ver actividades</summary>
        <table className="report-table" style={{ marginTop: '.5rem' }}>
          <tbody>
            {acts.map((a) => (
              <tr key={a.id}>
                <td>{fmtTime(a.startTime)}</td>
                <td>{appNameOf(a.domain, lists.apps)}</td>
                <td>{a.title}</td>
                <td className="num">{fmtDur(a.duration)}</td>
              </tr>
            ))}
            {acts.length < s.activityIds.length && <tr><td colSpan={4} className="muted">Hay actividades de esta sugerencia que ya no existen.</td></tr>}
          </tbody>
        </table>
      </details>

      {pending && mode === 'view' && (
        <>
          {error && <div className="alert alert-error" style={{ marginTop: '.7rem' }}>{error}</div>}
          <div className="suggestion-actions">
            <button className="btn btn-sm" disabled={busy} onClick={approve}>Aprobar</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={openEdit}>Editar</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setError(null); setMode('reject') }}>Rechazar</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={remove} title="Deshace la sugerencia y libera sus actividades">Eliminar sugerencia</button>
          </div>
        </>
      )}
    </div>
  )
}
