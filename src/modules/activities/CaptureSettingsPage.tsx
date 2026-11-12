import React, { useEffect, useState } from 'react'
import { where } from 'firebase/firestore'
import { useAuth } from '../../hooks/useAuth'
import { activitiesService } from './activitiesService'
import { subscribeCaptureSettings, saveCaptureSettings } from './captureSettingsService'
import { normalizeDomain, isValidDomain, matchesDomain } from '../../services/domains'
import { CaptureSettings } from '../../models'

export default function CaptureSettingsPage() {
  const { profile } = useAuth()
  const [settings, setSettings] = useState<CaptureSettings | null>(null)
  const [domainInput, setDomainInput] = useState('')
  const [pending, setPending] = useState<{ domain: string; ids: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    return subscribeCaptureSettings(profile.id, setSettings)
  }, [profile])

  if (!profile) return null
  if (!settings) return <div className="module-page"><p>Cargando…</p></div>

  // ---------- HU-58: dominios excluidos ----------
  const addDomain = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null); setNotice(null); setPending(null)
    const domain = normalizeDomain(domainInput)
    if (!isValidDomain(domain)) return setError('Escribe un dominio válido, por ejemplo facebook.com')
    if (settings.excludedDomains.includes(domain)) return setError('Ese dominio ya está excluido.')
    await saveCaptureSettings(profile.id, { excludedDomains: [...settings.excludedDomains, domain] })
    setDomainInput('')
    // ¿Ya hay actividades capturadas de ese dominio? Se ofrece borrarlas.
    const mine = await activitiesService.list([where('userId', '==', profile.id)])
    const ids = mine.filter((a) => matchesDomain(a.domain, domain)).map((a) => a.id)
    if (ids.length > 0) setPending({ domain, ids })
    else setNotice(`Se excluyó ${domain}. Dejará de registrarse en tu extensión en unos minutos.`)
  }

  const removeDomain = async (domain: string) => {
    setNotice(null); setPending(null)
    await saveCaptureSettings(profile.id, { excludedDomains: settings.excludedDomains.filter((d) => d !== domain) })
  }

  const deleteCaptured = async () => {
    if (!pending) return
    await Promise.all(pending.ids.map((id) => activitiesService.remove(id)))
    setNotice(`Se eliminaron ${pending.ids.length} actividades de ${pending.domain}.`)
    setPending(null)
  }

  return (
    <div className="module-page">
      <h1>Mi captura</h1>
      <p className="page-subtitle">Decide qué sitios nunca se registran con Lea Memory</p>

      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="card">
        <h2>Sitios excluidos</h2>
        <p className="module-note" style={{ marginTop: 0 }}>
          Aunque el Administrador haya autorizado una aplicación, nunca se registrará la actividad en estos sitios (ni en sus subdominios).
          Los cambios llegan a tu extensión de Chrome en un máximo de 5 minutos.
        </p>
        <form className="add-row" onSubmit={addDomain}>
          <input placeholder="Dominio (ej. facebook.com)" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} required />
          <button className="btn btn-sm" type="submit">+ Excluir</button>
        </form>
        {error && <div className="alert alert-error" style={{ marginTop: '.7rem' }}>{error}</div>}

        {pending && (
          <div className="alert alert-info" style={{ marginTop: '.7rem' }}>
            Ya hay <strong>{pending.ids.length}</strong> actividad(es) capturada(s) de <strong>{pending.domain}</strong>. ¿Quieres eliminarlas?
            <div className="add-row">
              <button className="btn btn-danger btn-sm" onClick={deleteCaptured}>Eliminarlas</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setNotice(`Se excluyó ${pending.domain}; se conservaron tus actividades anteriores.`); setPending(null) }}>Conservarlas</button>
            </div>
          </div>
        )}

        {settings.excludedDomains.length === 0 ? (
          <p className="module-note">No has excluido ningún sitio.</p>
        ) : (
          <div className="chips-row" style={{ marginTop: '.8rem' }}>
            {settings.excludedDomains.map((d) => (
              <span key={d} className="chip-btn domain-chip">{d} <button aria-label={`Quitar ${d}`} onClick={() => removeDomain(d)}>×</button></span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
