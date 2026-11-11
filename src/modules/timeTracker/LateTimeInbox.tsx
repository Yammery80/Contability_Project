import React, { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, where } from 'firebase/firestore'
import { auth, db } from '../../firebase/config'
import type { AppUser, Task, TimeEntry } from '../../models'

interface RequestRow {
  id: string
  entry: Omit<TimeEntry, 'id'>
  kind?: 'STANDARD'
  reason?: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  requestedAt: Timestamp | null
  reviewedBy?: string
  reviewedAt?: Timestamp
}

const labels = { PENDING: 'Pendiente', APPROVED: 'Aprobada', REJECTED: 'Rechazada' }

export default function LateTimeInbox({ profile, users, tasks }: { profile: AppUser; users: AppUser[]; tasks: Task[] }) {
  const [rows, setRows] = useState<RequestRow[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const review = ['SUPERVISOR', 'ADMIN', 'SUPERUSER'].includes(profile.role)
  useEffect(() => {
    setRows([])
    const requests = collection(db, 'lateTimeRequests')
    return onSnapshot(review ? requests : query(requests, where('entry.userId', '==', profile.id)),
      snapshot => setRows(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as RequestRow))
        .sort((a,b) => (b.requestedAt?.toMillis() ?? 0) - (a.requestedAt?.toMillis() ?? 0))),
      () => setError('No se pudieron cargar las solicitudes.'))
  }, [profile.id, review])

  async function decide(id: string, approve: boolean) {
    setBusy(id)
    setError('')
    try {
      await runTransaction(db, async tx => {
        const ref = doc(db, 'lateTimeRequests', id)
        const request = (await tx.get(ref)).data() as RequestRow | undefined
        if (request?.status !== 'PENDING') throw new Error()
        tx.update(ref, { status: approve ? 'APPROVED' : 'REJECTED', reviewedBy: auth.currentUser!.uid, reviewedAt: serverTimestamp() })
        if (approve) tx.set(doc(db, 'timeEntries', id), { ...request.entry, authorizationId: id })
      })
    } catch { setError('No se pudo guardar la decisión. Revisa el estado y tus permisos.') }
    finally { setBusy('') }
  }

  const name = (id: string) => users.find(u => u.id === id)?.name ?? id
  return <section className="card">
    <h2>{review ? 'Solicitudes de tiempo' : 'Mis solicitudes de tiempo'}</h2>
    {error && <p role="alert">{error}</p>}
    {!rows.length && !error && <p>Sin solicitudes.</p>}
    {rows.map(r => <article key={r.id}>
      <h3>{r.entry.description || 'Registro de tiempo'} · {labels[r.status]}</h3>
      <p>{name(r.entry.userId)} · {new Date(r.entry.startTime!).toLocaleString('es-MX')} a {new Date(r.entry.endTime!).toLocaleTimeString('es-MX')} · {r.entry.duration / 60} min</p>
      {r.entry.taskId && <p>Tarea: {tasks.find(t => t.id === r.entry.taskId)?.title ?? r.entry.taskId}</p>}
      {r.kind === 'STANDARD' ? <p>Solicitud de registro</p> : <p>Motivo del registro extemporáneo: {r.reason}</p>}
      {r.reviewedBy && <p>Revisó {name(r.reviewedBy)} · {r.reviewedAt?.toDate().toLocaleString('es-MX')}</p>}
      {review && r.entry.userId !== profile.id && r.status === 'PENDING' && <div className="timer-actions">
        <button disabled={Boolean(busy)} onClick={() => decide(r.id, true)}>Aprobar</button>
        <button disabled={Boolean(busy)} onClick={() => decide(r.id, false)}>Rechazar</button>
      </div>}
    </article>)}
  </section>
}
