import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { where } from 'firebase/firestore'
import { activitiesService } from './activitiesService'
import { trackedAppsService } from './trackedAppsService'
import { appNameOf } from './appName'
import { dayRange, fmtDur, fmtTime, todayStr } from './format'
import { timeSuggestionsService } from '../suggestions/timeSuggestionsService'
import { buildSuggestion, groupActivities, totalSeconds, MIN_BLOCK_SECONDS } from '../suggestions/groupActivities'
import { useAuth, homeRouteForRole } from '../../hooks/useAuth'
import { Activity, TimeSuggestion, TrackedApp } from '../../models'

export default function ActivityHistoryPage() {
  const { profile } = useAuth()
  const [all, setAll] = useState<Activity[]>([])
  const [apps, setApps] = useState<TrackedApp[]>([])
  const [suggestions, setSuggestions] = useState<TimeSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [day, setDay] = useState(todayStr())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; link?: boolean } | null>(null)

  useEffect(() => trackedAppsService.subscribe(setApps), [])

  // Las reglas solo dejan leer lo propio: las consultas SIEMPRE filtran por userId.
  useEffect(() => {
    if (!profile) return
    const u1 = activitiesService.subscribe((items) => { setAll(items); setLoading(false) }, [where('userId', '==', profile.id)])
    const u2 = timeSuggestionsService.subscribe(setSuggestions, [where('userId', '==', profile.id)])
    return () => { u1(); u2() }
  }, [profile])

  const [start, end] = dayRange(day)
  const rows = useMemo(
    () => all.filter((a) => a.startTime >= start && a.startTime < end).sort((a, b) => a.startTime - b.startTime),
    [all, start, end]
  )

  // Actividades que ya están en una sugerencia pendiente o aprobada no se pueden volver a elegir (HU-60).
  // Las de una sugerencia descartada no se sugieren solas (HU-61), pero se pueden elegir a mano.
  const { blocked, discarded } = useMemo(() => {
    const blocked = new Map<string, 'PENDING' | 'APPROVED'>()
    const discarded = new Set<string>()
    suggestions.forEach((s) => s.activityIds.forEach((id) => {
      if (s.status === 'DISCARDED') discarded.add(id)
      else blocked.set(id, s.status)
    }))
    return { blocked, discarded }
  }, [suggestions])

  const selectable = useMemo(() => rows.filter((r) => !blocked.has(r.id)), [rows, blocked])

  // Si cambia el día o una actividad deja de estar disponible, se limpia lo seleccionado que ya no aplica.
  useEffect(() => {
    setSelected((prev) => new Set([...prev].filter((id) => selectable.some((r) => r.id === id))))
  }, [selectable])

  const selectedRows = selectable.filter((r) => selected.has(r.id))
  const selectedSeconds = totalSeconds(selectedRows)
  const daySeconds = totalSeconds(rows)
  const byApp = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((a) => { const n = appNameOf(a.domain, apps); m.set(n, (m.get(n) ?? 0) + a.duration) })
    return [...m.entries()].map(([name, seconds]) => ({ name, seconds })).sort((a, b) => b.seconds - a.seconds)
  }, [rows, apps])
  const maxSeconds = Math.max(1, ...byApp.map((r) => r.seconds))

  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allSelected = selectable.length > 0 && selected.size === selectable.length
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((r) => r.id)))

  const removeSelected = async () => {
    if (!window.confirm(`¿Eliminar ${selected.size} actividad(es)? Esta acción no se puede deshacer.`)) return
    setBusy(true)
    try { await Promise.all([...selected].map((id) => activitiesService.remove(id))) } finally { setBusy(false) }
  }

  // HU-60: una sugerencia con exactamente lo que la persona seleccionó.
  const suggestSelected = async () => {
    if (!profile || selectedRows.length === 0) return
    setBusy(true); setNotice(null)
    try {
      await timeSuggestionsService.create(buildSuggestion(selectedRows, profile.id, (d) => appNameOf(d, apps)))
      setNotice({ text: `Se creó 1 sugerencia con ${selectedRows.length} actividad(es) (${fmtDur(selectedSeconds)}).`, link: true })
      setSelected(new Set())
    } finally { setBusy(false) }
  }

  // HU-61: el sistema agrupa solo las actividades disponibles del día en bloques de trabajo.
  const suggestDay = async () => {
    if (!profile) return
    setNotice(null)
    const available = rows.filter((r) => !blocked.has(r.id) && !discarded.has(r.id))
    if (available.length === 0) return setNotice({ text: 'No hay actividades disponibles para sugerir en este día.' })
    const groups = groupActivities(available)
    const valid = groups.filter((g) => totalSeconds(g) >= MIN_BLOCK_SECONDS)
    const skipped = groups.filter((g) => totalSeconds(g) < MIN_BLOCK_SECONDS).reduce((n, g) => n + g.length, 0)
    if (valid.length === 0) {
      return setNotice({ text: 'Las actividades de este día son muy cortas para sugerir horas solas. Puedes seleccionarlas y generar una sugerencia a mano.' })
    }
    setBusy(true)
    try {
      await Promise.all(valid.map((g) => timeSuggestionsService.create(buildSuggestion(g, profile.id, (d) => appNameOf(d, apps)))))
      const used = valid.reduce((n, g) => n + g.length, 0)
      setNotice({
        text: `Se generaron ${valid.length} sugerencia(s) con ${used} actividad(es).` + (skipped ? ` ${skipped} actividad(es) muy cortas quedaron sin agrupar.` : ''),
        link: true,
      })
      setSelected(new Set())
    } finally { setBusy(false) }
  }

  const base = profile ? homeRouteForRole(profile.role) : ''

  return (
    <div className="module-page">
      <h1>Historial de actividades</h1>
      <p className="page-subtitle">Lo que capturó la extensión de Chrome · solo tú puedes ver tu historial</p>

      {notice && (
        <div className="alert alert-success">
          {notice.text} {notice.link && <Link to={`${base}/suggestions`}>Ver sugerencias de horas</Link>}
        </div>
      )}

      <div className="toolbar">
        <input type="date" value={day} max={todayStr()} onChange={(e) => e.target.value && setDay(e.target.value)} />
        {day !== todayStr() && <button className="btn btn-ghost btn-sm" onClick={() => setDay(todayStr())}>Hoy</button>}
        <button className="btn btn-ghost push-right" disabled={busy || rows.length === 0} onClick={suggestDay}>Sugerir horas del día</button>
        <button className="btn" disabled={selected.size === 0 || busy} onClick={suggestSelected}>
          Generar sugerencia con las seleccionadas{selected.size > 0 ? ` (${fmtDur(selectedSeconds)})` : ''}
        </button>
        <button className="btn btn-danger" disabled={selected.size === 0 || busy} onClick={removeSelected}>
          Eliminar{selected.size > 0 ? ` (${selected.size})` : ''}
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><span className="stat-label">Tiempo capturado</span><span className="stat-value">{fmtDur(daySeconds)}</span></div>
        <div className="stat-card"><span className="stat-label">Actividades</span><span className="stat-value">{rows.length}</span></div>
        <div className="stat-card"><span className="stat-label">Seleccionado</span><span className="stat-value">{fmtDur(selectedSeconds)}</span><span className="stat-sub">{selected.size} actividad(es)</span></div>
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
              <th style={{ width: 32 }}><input type="checkbox" checked={allSelected} disabled={selectable.length === 0} onChange={toggleAll} aria-label="Seleccionar todas" /></th>
              <th>Horario</th><th>Aplicación</th><th>Página</th><th className="num">Duración</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="muted">No hay actividades capturadas este día.</td></tr>}
            {rows.map((a) => {
              const state = blocked.get(a.id)
              return (
                <tr key={a.id} className={state ? 'row-muted' : ''}>
                  <td><input type="checkbox" checked={selected.has(a.id)} disabled={!!state} onChange={() => toggle(a.id)} aria-label={`Seleccionar ${a.title}`} /></td>
                  <td>{fmtTime(a.startTime)} – {fmtTime(a.endTime)}</td>
                  <td>
                    <strong>{appNameOf(a.domain, apps)}</strong>
                    {state && <span className={'pill ' + (state === 'APPROVED' ? 'ok' : 'neutral')} style={{ marginLeft: '.4rem' }}>{state === 'APPROVED' ? 'Registrada' : 'En sugerencia'}</span>}
                    <br /><small className="muted">{a.domain}</small>
                  </td>
                  <td>{a.title}</td>
                  <td className="num">{fmtDur(a.duration)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p className="footnote">
        Estas actividades aún no son horas oficiales. Selecciona las que quieras o usa «Sugerir horas del día», revisa el resultado en
        «Sugerencias de horas» y, al aprobarlas, pasarán a «Registro de tiempos». Para borrar una actividad que ya está en una sugerencia, primero elimina la sugerencia.
      </p>
    </div>
  )
}
