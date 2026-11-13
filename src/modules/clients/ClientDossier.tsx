import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { addDoc, collection, doc, onSnapshot, query, where, type QueryConstraint } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { homeRouteForRole, useAuth } from '../../hooks/useAuth'
import type { AppUser, Client, Obligation, Project, TimeEntry } from '../../models'
import { formatClock } from '../../services/billing'
import { entryDate } from '../../services/period'
import { downloadFiscalFile } from './fiscalFile'
import DossierDocuments from './DossierDocuments'

interface Contact {
  id: string; name: string; email: string; phone: string; position: string; primary: boolean; payments: boolean
}

function ClientContacts({ clientId, admin }: { clientId: string; admin: boolean }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const path = 'clients/' + clientId + '/contacts'
  useEffect(() => onSnapshot(collection(db, path), snap => {
    setContacts(snap.docs.map(d => ({ ...d.data(), id: d.id } as Contact)).sort((a,b) => a.name.localeCompare(b.name)))
  }, () => setError('No se pudieron cargar los contactos.')), [path])
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const value = (key: string) => String(data.get(key) || '').trim()
    const contact = { name: value('name'), phone: value('phone'), email: value('email'), position: value('position'),
      primary: data.has('primary'), payments: data.has('payments') }
    if (!contact.name || !contact.position || !/^[+0-9() -]{7,32}$/.test(contact.phone) || !/\d/.test(contact.phone))
      return setError('Revisa el nombre, el cargo y el teléfono.')
    setSaving(true)
    setError('')
    try { await addDoc(collection(db, path), contact); form.reset() }
    catch { setError('No se pudo registrar el contacto.') }
    finally { setSaving(false) }
  }
  return <section className="card"><h2>Contactos</h2>
    <ul>{contacts.map(c => <li key={c.id}><strong>{c.name}</strong> · {c.position} · {c.phone} · {c.email}
      {c.primary && ' · Principal'}{c.payments && ' · Encargado de pagos'}</li>)}</ul>
    {!contacts.length && <p>Sin contactos adicionales.</p>}
    {admin && <details><summary>Registrar contacto</summary><form onSubmit={save} className="inline-form form-grid">
      <label>Nombre <input name="name" required maxLength={150} /></label>
      <label>Cargo <input name="position" required maxLength={120} /></label>
      <label>Teléfono <input name="phone" type="tel" required maxLength={32} /></label>
      <label>Correo <input name="email" type="email" required maxLength={254} /></label>
      <label><input type="checkbox" name="primary" /> Contacto principal</label>
      <label><input type="checkbox" name="payments" /> Encargado de pagos</label>
      <button disabled={saving}>{saving ? 'Guardando…' : 'Guardar contacto'}</button>
    </form></details>}
    {error && <p role="alert">{error}</p>}
  </section>
}

function RecordView({ client, profile }: { client: Client; profile: AppUser }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    const clientFilter = where('clientId','==',client.id)
    function watch<T>(name: string, filters: QueryConstraint[], set: (rows: T[]) => void) {
      return onSnapshot(query(collection(db, name), ...filters), snap => {
        set(snap.docs.map(d => ({ ...d.data(), id: d.id } as T)))
      }, () => setError('No se pudieron cargar todos los datos del expediente.'))
    }
    const timeFilters = [clientFilter]
    if (profile.role === 'OPERATOR') timeFilters.push(where('userId','==',profile.id))
    const stops = [watch('projects',[clientFilter],setProjects), watch('obligations',[clientFilter],setObligations),
      watch('timeEntries',timeFilters,setEntries)]
    return () => stops.forEach(stop => stop())
  }, [client.id, profile.id, profile.role])
  const [responsible, setResponsible] = useState('')
  useEffect(() => {
    setResponsible('')
    if (!client.responsibleUserId) return
    return onSnapshot(doc(db, 'users', client.responsibleUserId),
      snap => setResponsible(snap.data()?.name || 'Perfil no disponible'),
      () => setResponsible('Perfil no disponible'))
  }, [client.responsibleUserId])
  const states = { ACTIVE: 'Activo', INACTIVE: 'Inactivo', PAUSED: 'En pausa' }
  const history = entries.filter(e => e.status === 'STOPPED').sort((a,b) => entryDate(b) - entryDate(a))
  return <>
    <section className="card"><h2>{client.name}</h2>
      <p>{client.type === 'LEGAL_ENTITY' ? 'Persona moral' : 'Persona física'} · {states[client.status]}</p>
      <p>Responsable: {client.responsibleUserId ? responsible || 'Cargando…' : 'Sin asignar'}</p>
      <p>Correo: {client.email || 'Sin registrar'} · Teléfono: {client.phone || 'Sin registrar'}</p>
      <p>Régimen fiscal: {client.taxRegime || (client.hasFiscalFile ? 'Consultar documento fiscal' : 'Sin registrar')}</p>
      {client.hasFiscalFile && <button onClick={() => downloadFiscalFile(client.id).catch(() => setError('No se pudo descargar el documento fiscal.'))}>Descargar documento fiscal</button>}
      {client.updatedAt && <p>Última modificación: {new Date(client.updatedAt).toLocaleString('es-MX')}</p>}
    </section>
    {error && <p role="alert">{error}</p>}
    <ClientContacts clientId={client.id} admin={['ADMIN','SUPERUSER'].includes(profile.role)} />
    <section className="card"><h2>Proyectos</h2>{projects.length ? <ul>{projects.map(p => <li key={p.id}>{p.name} · {p.startDate} – {p.endDate}</li>)}</ul> : <p>Sin proyectos.</p>}</section>
    <section className="card"><h2>Obligaciones</h2>{obligations.length ? <ul>{obligations.map(o => <li key={o.id}>{o.name} · Vencimiento: {o.dueDate}</li>)}</ul> : <p>Sin obligaciones.</p>}</section>
    <section className="card"><h2>{profile.role === 'OPERATOR' ? 'Mis actividades registradas' : 'Actividades registradas'}</h2>
      {history.length ? <ul>{history.map(e => <li key={e.id}>{new Date(entryDate(e)).toLocaleDateString('es-MX')} · {e.description || 'Actividad sin descripción'} · {formatClock(e.duration)}</li>)}</ul> : <p>Sin actividades finalizadas.</p>}
    </section>
    <DossierDocuments client={client} profile={profile} />
  </>
}

export default function ClientDossier() {
  const { profile } = useAuth()
  const { clientId } = useParams()
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => onSnapshot(collection(db, 'clients'), snap => {
    setClients(snap.docs.map(d => ({ ...d.data(), id: d.id } as Client)).sort((a,b) => a.name.localeCompare(b.name)))
    setLoaded(true)
  }, () => setError('No se pudo consultar la lista de clientes.')), [])
  if (!profile) return null
  const client = clients.find(c => c.id === clientId)
  const base = homeRouteForRole(profile.role) + '/expedientes'
  return <div className="module-page"><h1>Expediente del cliente</h1>
    <label>Cliente <select value={clientId || ''} onChange={e => navigate(base + (e.target.value ? '/' + e.target.value : ''))}>
      <option value="">Selecciona un cliente</option>
      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select></label>
    {error && <p role="alert">{error}</p>}
    {loaded && clientId && !client && <p>Cliente no encontrado.</p>}
    {client && <RecordView key={client.id + profile.id} client={client} profile={profile} />}
  </div>
}
