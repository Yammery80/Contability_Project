import React, { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../../firebase/config'
import type { ActivityRef } from './useTimer'

export default function LateTimeForm({ activity, children, onSent }: {
  activity: ActivityRef
  children?: React.ReactNode
  onSent: () => void
}) {
  const [date, setDate] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [description, setDescription] = useState(activity.description)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const startTime = new Date(date + 'T' + from).getTime()
  const endTime = new Date(date + 'T' + to).getTime()
  const minutes = (endTime - startTime) / 60000

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    const userId = auth.currentUser?.uid
    if (!userId) return setError('Inicia sesión para enviar la solicitud.')
    if (!(minutes > 0) || endTime > Date.now()) return setError('Elige un intervalo ya trabajado. La hora final debe ser posterior a la inicial.')
    if (!description.trim() || !reason.trim()) return setError('Describe la actividad y explica por qué faltó el registro en tiempo real.')
    setBusy(true)
    setError('')
    try {
      const entry = { ...activity, description: description.trim(), userId, startTime, endTime,
        duration: minutes * 60, type: 'MANUAL', status: 'STOPPED' }
      await addDoc(collection(db, 'lateTimeRequests'), {
        entry, reason: reason.trim(), status: 'PENDING', requestedAt: serverTimestamp(),
      })
      onSent()
    } catch {
      setError('No se pudo enviar. Comprueba la conexión y tus permisos.')
    } finally { setBusy(false) }
  }

  return <form className="card" style={{maxWidth: 520, display: 'grid', gap: 12}} onSubmit={submit}>
    <h2>Solicitar registro de tiempo</h2>
    <strong>{minutes > 0 ? Math.floor(minutes / 60) + ' h ' + minutes % 60 + ' min' : '0 h 0 min'}</strong>
    {children}
    <label>Fecha de la actividad <input required type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
    <label>Hora de inicio <input required type="time" value={from} onChange={e => setFrom(e.target.value)} /></label>
    <label>Hora de término <input required type="time" value={to} onChange={e => setTo(e.target.value)} /></label>
    <label>Actividad realizada <textarea required maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} /></label>
    <label>¿Por qué faltó el registro en tiempo real? <textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
  </form>
}
