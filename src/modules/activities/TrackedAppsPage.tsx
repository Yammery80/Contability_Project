import React, { useEffect, useState } from 'react'
import { trackedAppsService } from './trackedAppsService'
import { useAuth } from '../../hooks/useAuth'
import { TrackedApp } from '../../models'

// "https://www.Mail.Google.com/inbox?x=1" -> "mail.google.com"
export function normalizeDomain(input: string): string {
  return input.trim().toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, '')
    .replace(/^www\./, '')
}
const DOMAIN_RE = /^([a-z0-9-]+\.)+[a-z]{2,}$/

// Atajos para no escribir los dominios más comunes.
const SUGGESTIONS = [
  { name: 'Gmail', domain: 'mail.google.com' },
  { name: 'Google Calendar', domain: 'calendar.google.com' },
  { name: 'Google Docs / Sheets', domain: 'docs.google.com' },
  { name: 'Google Drive', domain: 'drive.google.com' },
  { name: 'Outlook (web)', domain: 'outlook.office.com' },
  { name: 'Microsoft Teams', domain: 'teams.microsoft.com' },
  { name: 'SAT', domain: 'sat.gob.mx' },
  { name: 'IMSS', domain: 'imss.gob.mx' },
]

export default function TrackedAppsPage() {
  const { profile } = useAuth()
  const [apps, setApps] = useState<TrackedApp[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', domain: '' })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => trackedAppsService.subscribe((items) => { setApps(items); setLoading(false) }), [])

  const add = async (name: string, rawDomain: string) => {
    setError(null)
    const domain = normalizeDomain(rawDomain)
    if (!DOMAIN_RE.test(domain)) return setError('Escribe un dominio válido, por ejemplo mail.google.com')
    if (apps.some((a) => normalizeDomain(a.domain) === domain)) return setError('Esa aplicación ya está en la lista.')
    await trackedAppsService.create({ name: name.trim() || domain, domain, active: true, createdAt: Date.now(), createdBy: profile?.id ?? '' })
    setForm({ name: '', domain: '' })
  }

  const remove = async (a: TrackedApp) => {
    if (window.confirm(`¿Quitar "${a.name}" de la lista? Dejará de registrarse en todos los equipos.`)) await trackedAppsService.remove(a.id)
  }

  const sorted = [...apps].sort((a, b) => a.name.localeCompare(b.name))
  const missing = SUGGESTIONS.filter((s) => !apps.some((a) => normalizeDomain(a.domain) === s.domain))

  return (
    <div className="module-page">
      <h1>Aplicaciones a registrar</h1>
      <p className="page-subtitle">Lea Memory solo registra la actividad de tu equipo cuando entra a las aplicaciones de esta lista</p>

      <div className="alert alert-info">
        Es una lista de <strong>sitios web</strong>: un dominio cubre también sus subdominios (<code>sat.gob.mx</code> incluye <code>portal.sat.gob.mx</code>).
        Los cambios llegan a todas las extensiones en un máximo de 15 minutos. Mientras la lista esté vacía no se registra nada.
        Los programas de escritorio (Excel, Word, etc.) no se pueden detectar desde el navegador.
      </div>

      <form className="inline-form form-grid" onSubmit={(e) => { e.preventDefault(); void add(form.name, form.domain) }}>
        <input placeholder="Nombre (ej. Gmail)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Dominio (ej. mail.google.com)" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} required />
        <button type="submit">+ Agregar aplicación</button>
        {error && <div className="form-error">{error}</div>}
      </form>

      {missing.length > 0 && (
        <div className="chips-row">
          <span className="muted">Agregar rápido:</span>
          {missing.map((s) => <button key={s.domain} type="button" className="chip-btn" onClick={() => add(s.name, s.domain)}>+ {s.name}</button>)}
        </div>
      )}

      {loading ? <p>Cargando…</p> : (
        <table className="data-table">
          <thead><tr><th>Aplicación</th><th>Dominio</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={4} className="muted">Aún no hay aplicaciones: por ahora no se registra ninguna actividad.</td></tr>}
            {sorted.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.name}</strong></td>
                <td>{a.domain}</td>
                <td><span className={'pill ' + (a.active ? 'ok' : 'off')}>{a.active ? 'Activa' : 'Desactivada'}</span></td>
                <td className="row-actions">
                  <button onClick={() => trackedAppsService.update(a.id, { active: !a.active })}>{a.active ? 'Desactivar' : 'Activar'}</button>
                  <button onClick={() => remove(a)}>Quitar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
