import { useState } from 'react'
import { FirebaseError } from 'firebase/app'
import { firebaseConfig } from '../../firebase/config'
import type { AppUser, Client } from '../../models'
import { type ActivityRecord, detailHeaders, detailValues, missingFields } from './activityDetail'
import { saveReportDetail } from './saveReportDetail'
import './reportActivities.css'

interface DirectoryProps {
  clients: Map<string, Client>
  users: Map<string, AppUser>
  canEditClient: boolean
}

function saveErrorMessage(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return error instanceof Error ? error.message : 'No se pudo guardar el detalle. Vuelve a intentarlo.'
  }
  switch (error.code) {
    case 'permission-denied':
      return `Firestore denegó el guardado en ${firebaseConfig.projectId} (permission-denied). Pide al administrador que revise tu acceso y las reglas de Reportes de ese proyecto.`
    case 'unauthenticated':
      return 'Tu sesión caducó. Copia lo que escribiste y vuelve a iniciar sesión.'
    case 'unavailable':
    case 'deadline-exceeded':
      return 'Firestore no respondió. Conserva el formulario abierto y vuelve a guardar cuando tengas conexión.'
    default:
      return `No se pudo guardar el detalle (${error.code}). Vuelve a intentarlo.`
  }
}

function DetailForm({ row, clients, users, canEditClient, onSave, onCancel }: DirectoryProps & {
  row: ActivityRecord; onSave: () => void; onCancel: () => void
}) {
  const [draft, setDraft] = useState(row.detail)
  const [originalGiro, setOriginalGiro] = useState(row.businessActivity)
  const [giro, setGiro] = useState(row.businessActivity)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const client = clients.get(draft.clientId)

  function selectClient(id: string) {
    const selected = clients.get(id)
    setDraft({ ...draft, clientId: id, clientName: selected?.name || '' })
    const nextGiro = selected?.businessActivity?.trim() || ''
    setGiro(nextGiro)
    setOriginalGiro(nextGiro)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    const detail = { ...draft, responsibleName: draft.responsibleName.trim(), clientName: draft.clientName.trim(),
      activity: draft.activity.trim(), purpose: draft.purpose.trim() }
    const missing = missingFields(detail)
    if (missing.length) return setError('Falta completar ' + missing.join(', ') + '.')
    setSaving(true)
    setError('')
    try {
      await saveReportDetail(row, detail, canEditClient && client ? { before: originalGiro, after: giro.trim() } : undefined)
      onSave()
    } catch (err) {
      setError(saveErrorMessage(err))
    } finally { setSaving(false) }
  }

  return <form className="report-detail-form no-print" onSubmit={submit} aria-label="Datos de la actividad">
    <fieldset disabled={saving}>
      <legend>Datos para el reporte</legend>
      {!row.sourceClientId && <label>Cliente
        <select required value={draft.clientId} onChange={e => selectClient(e.target.value)}>
          <option value="">Selecciona un cliente</option>
          {draft.clientId && !client && <option value={draft.clientId}>{draft.clientName || draft.clientId}</option>}
          {Array.from(clients.values(), c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>}
      {(row.sourceClientId || !client?.name) && <label>Nombre del cliente
        <input required readOnly={!!client?.name?.trim()} maxLength={300} value={draft.clientName}
          onChange={e => setDraft({ ...draft, clientName: e.target.value })} />
      </label>}
      {canEditClient && client ? <label>Giro del cliente (ficha del cliente)
        <input maxLength={200} value={giro} onChange={e => setGiro(e.target.value)} placeholder="Ej. comercio de abarrotes" />
      </label> : <p>Giro del cliente: {giro || 'Sin registrar'}</p>}
      <label>Nombre del responsable
        <input required readOnly={!!users.get(draft.userId)?.name?.trim()} maxLength={300} value={draft.responsibleName}
          onChange={e => setDraft({ ...draft, responsibleName: e.target.value })} />
      </label>
      <label>{row.kind === 'obligations' ? 'Fecha límite' : 'Fecha de trabajo'}
        <input required type="date" readOnly={!!row.sourceDate} value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
      </label>
      <label>Actividad realizada o asignada
        <textarea required maxLength={1000} value={draft.activity} onChange={e => setDraft({ ...draft, activity: e.target.value })}
          placeholder="Ej. elaborar la nómina quincenal o conciliar un pago" />
      </label>
      <label>Motivo del trabajo
        <textarea required maxLength={1000} value={draft.purpose} onChange={e => setDraft({ ...draft, purpose: e.target.value })}
          placeholder="¿Qué necesidad del cliente atendió esta actividad?" />
      </label>
      {error && <p role="alert">{error}</p>}
      <div><button type="submit" className="btn">{saving ? 'Guardando…' : 'Guardar detalle'}</button>
        {' '}<button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button></div>
    </fieldset>
  </form>
}

export default function ReportActivities({ records, clients, users, canEditClient }: DirectoryProps & { records: ActivityRecord[] }) {
  const [editing, setEditing] = useState<ActivityRecord | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  if (!records.length) return null
  return <section className="report-activities">
    <h4>Detalle de actividades por cliente</h4>
    {records.map(row => {
      const values = detailValues(row)
      const missing = missingFields(row.detail)
      const isEditing = editing?.id === row.id && editing.kind === row.kind
      return <article key={row.id} className="report-activity">
        <dl>{detailHeaders(row.kind).map((label, i) =>
          <div key={label}><dt>{label}</dt><dd>{values[i] || 'Sin registrar'}</dd></div>)}</dl>
        {missing.length > 0 && !isEditing && <p className="footnote">Falta completar {missing.join(', ')}.</p>}
        {isEditing
          ? <DetailForm key={row.id} row={editing} clients={clients} users={users} canEditClient={canEditClient}
              onSave={() => {
                setSavedId(row.id)
                setEditing(current => current === editing ? null : current)
              }} onCancel={() => setEditing(null)} />
          : <button type="button" className="btn btn-ghost no-print" onClick={() => { setSavedId(null); setEditing(row) }}>
            {missing.length ? 'Completar detalle' : 'Editar detalle'}</button>}
        {savedId === row.id && <p role="status" className="footnote no-print">Detalle guardado.</p>}
      </article>
    })}
  </section>
}
