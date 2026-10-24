import React, { useEffect, useMemo, useState } from 'react'
import { where } from 'firebase/firestore'
import { activitiesService } from './activitiesService'
import { trackedAppsService } from './trackedAppsService'
import { useAuth } from '../../hooks/useAuth'
import { Activity, TrackedApp } from '../../models'

const pad = (n: number) => String(n).padStart(2, '0')
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

// Inicio y fin (ms) del día elegido, en hora local.
function dayRange(day: string): [number, number] {
  const [y, m, d] = day.split('-').map(Number)
  return [new Date(y, m - 1, d).getTime(), new Date(y, m - 1, d + 1).getTime()]
}

const fmtTime = (ms: number) => `${pad(new Date(ms).getHours())}:${pad(new Date(ms).getMinutes())}`

function fmtDur(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${m % 60} min`
}

// Una página pertenece a una aplicación si su dominio es igual al de la lista o es un subdominio suyo.
function appNameOf(domain: string, apps: TrackedApp[]): string {
  return apps.find((a) => domain === a.domain || domain.endsWith('.' + a.domain))?.name ?? domain
}

export default function ActivityHistoryPage() {
  const { profile } = useAuth()
  const [all, setAll] = useState<Activity[]>([])
  const [apps, setApps] = useState<TrackedApp[]>([])
  const [loading, setLoading] = useState(true)
  const [day, setDay] = useState(todayStr())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => trackedAppsService.subscribe(setApps), [])

  // Las reglas solo dejan leer las propias: la consulta SIEMPRE filtra por userId.
  useEffect(() => {
    if (!profile) return
    return activitiesService.subscribe(
      (items) => { setAll(items); setLoading(false) },
      [where('userId', '==', profile.id)]
    )
  }, [profile])

  const [start, end] = dayRange(day)
  const rows = useMemo(
    () => all.filter((a) => a.startTime >= start && a.startTime < end).sort((a, b) => a.startTime - b.startTime),
    [all, start, end]
  )

  // Si cambia el día o se borran filas, se limpia lo seleccionado que ya no está a la vista.
  useEffect(() => {
    setSelected((prev) => new Set([...prev].filter((id) => rows.some((r) => r.id === id))))
  }, [rows])

  const totalSeconds = rows.reduce((s, a) => s + a.duration, 0)
  const byApp = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((a) => { const n = appNameOf(a.domain, apps); m.set(n, (m.get(n) ?? 0) + a.duration) })
    return [...m.entries()].map(([name, seconds]) => ({ name, seconds })).sort((a, b) => b.seconds - a.seconds)
  }, [rows, apps])
  const maxSeconds = Math.max(1, ...byApp.map((r) => r.seconds))

  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allSelected = rows.length > 0 && selected.size === rows.length
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))

  const removeSelected = async () => {
    if (!window.confirm(`¿Eliminar ${selected.size} actividad(es)? Esta acción no se puede deshacer.`)) return
    setBusy(true)
    try { await Promise.all([...selected].map((id) => activitiesService.remove(id))) } finally { setBusy(false) }
  }

  return (
    <div className="module-page">
      <h1>Historial de actividades</h1>
      <p className="page-subtitle">Lo que capturó la extensión de Chrome · solo tú puedes ver tu historial</p>

      <div className="toolbar">
        <input type="date" value={day} max={todayStr()} onChange={(e) => e.target.value && setDay(e.target.value)} />
        {day !== todayStr() && <button className="btn btn-ghost btn-sm" onClick={() => setDay(todayStr())}>Hoy</button>}
        <button className="btn btn-danger push-right" disabled={selected.size === 0 || busy} onClick={removeSelected}>
          Eliminar seleccionadas{selected.size > 0 ? ` (${selected.size})` : ''}
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><span className="stat-label">Tiempo capturado</span><span className="stat-value">{fmtDur(totalSeconds)}</span></div>
        <div className="stat-card"><span className="stat-label">Actividades</span><span className="stat-value">{rows.length}</span></div>
        <div className="stat-card"><span className="stat-label">Aplicaciones</span><span className="stat-value">{byApp.length}</span></div>
      </div>

      {byApp.length > 0 && (
        <div className="card" style={{ marginBottom: '1.1rem' }}>
          <h2>Por aplicación</h2>
          {byApp.map((r) => (
            <div className="bar-row" key={r.name}>
              <span className="bar-label">{r.name}</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${(r.seconds / maxSeconds) * 100}%` }} /></div>
              <span className="bar-value">{fmtDur(r.seconds)}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? <p>Cargando…</p> : (
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Seleccionar todas" /></th>
              <th>Horario</th><th>Aplicación</th><th>Página</th><th className="num">Duración</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="muted">No hay actividades capturadas este día.</td></tr>}
            {rows.map((a) => (
              <tr key={a.id}>
                <td><input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} /></td>
                <td>{fmtTime(a.startTime)} – {fmtTime(a.endTime)}</td>
                <td><strong>{appNameOf(a.domain, apps)}</strong><br /><small className="muted">{a.domain}</small></td>
                <td>{a.title}</td>
                <td className="num">{fmtDur(a.duration)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="footnote">
        Estas actividades aún no son horas oficiales: no aparecen en «Registro de tiempos» ni en los reportes.
        El siguiente paso (sugerencias y aprobación) las convertirá en registros de tiempo.
      </p>
    </div>
  )
}
