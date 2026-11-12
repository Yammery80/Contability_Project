import React, { useState } from 'react'
import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore'
import { auth, db } from '../../firebase/config'
import { addTimeNotice } from './timeRequestNotices'
import { useAuth } from '../../hooks/useAuth'
import type { ActivityRef } from './useTimer'

export default function LateTimeForm({ activity, children, onSent, title = 'Solicitar registro de tiempo', onCancel }: {
  title?: string
  onCancel?: () => void
  activity: ActivityRef
  children?: React.ReactNode
  onSent: () => void
}) {
  const { profile } = useAuth()
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
      const supervisors = await getDocs(query(collection(db, 'users'), where('role', '==', 'SUPERVISOR')))
      const requestRef = doc(collection(db, 'lateTimeRequests'))
      const batch = writeBatch(db)
      batch.set(requestRef, {
        entry, reason: reason.trim(), status: 'PENDING', requestedAt: serverTimestamp(),
      })
      const detail = description.trim() + ' · ' + minutes + ' min'
      addTimeNotice(batch, requestRef.id, userId, 'pending', 'Registro extemporáneo pendiente', detail)
      for (const supervisor of supervisors.docs) {
        if (supervisor.data().active === true && supervisor.id !== userId) {
          addTimeNotice(batch, requestRef.id, supervisor.id, 'pending', 'Solicitud extemporánea por revisar',
            (profile?.name || 'Un colaborador') + ' · ' + detail)
        }
      }
      await batch.commit()
      onSent()
    } catch {
      setError('No se pudo enviar. Comprueba la conexión y tus permisos.')
    } finally { setBusy(false) }
  }

  return <form className="card" style={{maxWidth: 520, display: 'grid', gap: 12}} onSubmit={submit}>
    <h2>{title}</h2>
    <strong>{minutes > 0 ? Math.floor(minutes / 60) + ' h ' + minutes % 60 + ' min' : '0 h 0 min'}</strong>
    {children}
    <label>Fecha de la actividad <input required type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
    <label>Hora de inicio <input required type="time" value={from} onChange={e => setFrom(e.target.value)} /></label>
    <label>Hora de término <input required type="time" value={to} onChange={e => setTo(e.target.value)} /></label>
    <label>Actividad realizada <textarea required maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} /></label>
    <label>¿Por qué faltó el registro en tiempo real? <textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
    {onCancel && <button className="btn btn-ghost" type="button" disabled={busy} onClick={onCancel}>Cancelar</button>}
  </form>
}
