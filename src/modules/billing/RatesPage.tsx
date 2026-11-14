import React, { useEffect, useMemo, useState } from 'react'
import { where } from 'firebase/firestore'
import { clientsService } from '../clients/clientsService'
import { clientRatesService } from './ratesService'
import { useAuth } from '../../hooks/useAuth'
import { formatMoney, toDateStr, validateRatePeriod } from '../../services/billing'
import { Client, ClientRate } from '../../models'

// HU-48: tarifa por cliente y periodo. Solo Administrador / Superusuario.
export default function RatesPage() {
  const { profile } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [rates, setRates] = useState<ClientRate[]>([])
  const [form, setForm] = useState({ validFrom: '', validTo: '', hourlyRate: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => clientsService.subscribe(setClients), [])
  useEffect(() => {
    if (!clientId) { setRates([]); return }
    return clientRatesService.subscribe(setRates, [where('clientId', '==', clientId)])
  }, [clientId])

  const sorted = useMemo(() => [...rates].sort((a, b) => b.validFrom.localeCompare(a.validFrom)), [rates])
  const today = toDateStr(Date.now())
  const isCurrent = (r: ClientRate) => r.validFrom <= today && today <= (r.validTo || '9999-12-31')

  if (!profile) return null

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !clientId) return
    const candidate = { clientId, hourlyRate: Number(form.hourlyRate), validFrom: form.validFrom, validTo: form.validTo }
    const problem = validateRatePeriod(rates, candidate)
    if (problem) { setError(problem); return }
    setBusy(true); setError('')
    try {
      await clientRatesService.create({ ...candidate, createdAt: Date.now(), createdBy: profile.id })
      setForm({ validFrom: '', validTo: '', hourlyRate: '' })
    } catch (err) {
      console.error('Error al guardar tarifa:', err)
      setError('No se pudo guardar la tarifa. Verifica tus permisos.')
    } finally { setBusy(false) }
  }

  const handleDelete = async (r: ClientRate) => {
    if (!window.confirm(`¿Eliminar la tarifa de ${formatMoney(r.hourlyRate)}/h (${r.validFrom} → ${r.validTo || 'sin fin'})?`)) return
    try { await clientRatesService.remove(r.id) } catch { setError('No se pudo eliminar la tarifa.') }
  }

  return (
    <div className="module-page">
      <h1>Tarifas por cliente</h1>
      <p className="page-subtitle">
        Precio por hora que se cobra a cada cliente. El cobro estimado usa la tarifa vigente en la fecha en que se trabajó.
      </p>

      <div className="toolbar">
        <select value={clientId} onChange={(e) => { setClientId(e.target.value); setError('') }}>
          <option value="">Selecciona un cliente…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {clientId && (
        <>
          <form className="inline-form form-grid" onSubmit={handleAdd}>
            <label className="muted">Desde<input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} required /></label>
            <label className="muted">Hasta (opcional)<input type="date" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} /></label>
            <label className="muted">Tarifa por hora (MXN)<input type="number" min="1" step="0.01" placeholder="Ej. 450" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} required /></label>
            <button type="submit" className="btn" disabled={busy}>Agregar tarifa</button>
          </form>
          {error && <p role="alert" className="overdue">{error}</p>}

          <table className="data-table">
            <thead><tr><th>Desde</th><th>Hasta</th><th className="num">Tarifa / hora</th><th></th><th></th></tr></thead>
            <tbody>
              {sorted.length === 0 && <tr><td colSpan={5} className="muted">Este cliente todavía no tiene tarifas. Sus horas no se incluirán en el cobro estimado.</td></tr>}
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td>{r.validFrom}</td>
                  <td>{r.validTo || 'Sin fin'}</td>
                  <td className="num">{formatMoney(r.hourlyRate)}</td>
                  <td>{isCurrent(r) && <span className="status-pill status-active">Vigente</span>}</td>
                  <td className="row-actions"><button onClick={() => handleDelete(r)}>Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
