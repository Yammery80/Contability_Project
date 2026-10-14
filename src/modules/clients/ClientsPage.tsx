import React, { useEffect, useMemo, useState } from 'react'
import { clientsService } from './clientsService'
import { projectsService } from '../projects/projectsService'
import { tasksService } from '../tasks/tasksService'
import { timeEntriesService } from '../timeTracker/timeTrackerService'
import { currentMonthValue, entryDate, inRange, monthRange } from '../../services/period'
import { formatHours } from '../../services/billing'
import { useAuth } from '../../hooks/useAuth'
import { can } from '../../services/permissions'
import { Client, ClientStatus, ClientType, Project, Task, TimeEntry } from '../../models'

const emptyForm = { name: '', type: 'PHYSICAL_PERSON' as ClientType, email: '', phone: '' }

const STATUS_LABEL: Record<ClientStatus, string> = { ACTIVE: 'Activo', PAUSED: 'Pausa', INACTIVE: 'Inactivo' }
const STATUS_PILL: Record<ClientStatus, string> = { ACTIVE: 'ok', PAUSED: 'warn', INACTIVE: 'off' }
const TYPE_LABEL: Record<ClientType, string> = { PHYSICAL_PERSON: 'Persona física', LEGAL_ENTITY: 'Persona moral' }

export default function ClientsPage() {
  const { profile } = useAuth()
  const canEdit = can(profile?.role, 'clients.edit') // solo Administrador / Superusuario
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | ClientStatus>('ACTIVE')
  const [typeFilter, setTypeFilter] = useState<'ALL' | ClientType>('ALL')

  useEffect(() => {
    const u1 = clientsService.subscribe((items) => { setClients(items); setLoading(false) })
    const u2 = projectsService.subscribe(setProjects)
    const u3 = tasksService.subscribe(setTasks)
    const u4 = timeEntriesService.subscribe(setEntries)
    return () => { u1(); u2(); u3(); u4() }
  }, [])

  // Tareas activas y horas del mes por cliente (tarea → proyecto → cliente).
  const stats = useMemo(() => {
    const range = monthRange(currentMonthValue())
    const clientOfProject = new Map(projects.map((p) => [p.id, p.clientId]))
    const map = new Map<string, { tasks: number; seconds: number }>()
    const get = (id: string) => map.get(id) ?? { tasks: 0, seconds: 0 }
    tasks.filter((t) => t.status !== 'COMPLETED').forEach((t) => {
      const cid = clientOfProject.get(t.projectId)
      if (cid) map.set(cid, { ...get(cid), tasks: get(cid).tasks + 1 })
    })
    entries.filter((e) => e.status === 'STOPPED' && e.clientId && inRange(entryDate(e), range)).forEach((e) => {
      map.set(e.clientId, { ...get(e.clientId), seconds: get(e.clientId).seconds + e.duration })
    })
    return map
  }, [projects, tasks, entries])

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(false) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId) await clientsService.update(editingId, form)
    else await clientsService.create({ ...form, status: 'ACTIVE', createdAt: Date.now() })
    resetForm()
  }

  const handleEdit = (c: Client) => {
    setForm({ name: c.name, type: c.type, email: c.email, phone: c.phone })
    setEditingId(c.id)
    setShowForm(true)
  }

  const visible = clients
    .filter((c) => statusFilter === 'ALL' || c.status === statusFilter)
    .filter((c) => typeFilter === 'ALL' || c.type === typeFilter)
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="module-page">
      <h1>Clientes <span className="counter">({clients.length} / ~120 esperados)</span></h1>
      <p className="page-subtitle">Cartera del despacho · horas y tareas por cliente</p>

      <div className="toolbar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL' | ClientStatus)}>
          <option value="ALL">Estatus: Todos</option>
          <option value="ACTIVE">Estatus: Activos</option>
          <option value="PAUSED">Estatus: Pausa</option>
          <option value="INACTIVE">Estatus: Inactivos</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'ALL' | ClientType)}>
          <option value="ALL">Tipo: Todos</option>
          <option value="PHYSICAL_PERSON">Persona física</option>
          <option value="LEGAL_ENTITY">Persona moral</option>
        </select>
        <input placeholder="Buscar cliente…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {canEdit && <button className="btn push-right" onClick={() => (showForm ? resetForm() : setShowForm(true))}>{showForm ? 'Cancelar' : '+ Nuevo cliente'}</button>}
      </div>

      {showForm && canEdit && (
        <form className="inline-form form-grid" onSubmit={handleSubmit}>
          <input placeholder="Nombre o razón social" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ClientType })}>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input placeholder="Correo" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <button type="submit">{editingId ? 'Guardar cambios' : 'Crear cliente'}</button>
        </form>
      )}

      {loading ? <p>Cargando…</p> : (
        <table className="data-table">
          <thead>
            <tr><th>Cliente</th><th>Contacto</th><th className="num">Tareas activas</th><th className="num">Horas (mes)</th><th>Estatus</th><th></th></tr>
          </thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={6} className="muted">No hay clientes con estos filtros.</td></tr>}
            {visible.map((c) => {
              const st = stats.get(c.id)
              return (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong><br /><small className="muted">{TYPE_LABEL[c.type]}</small></td>
                  <td>{c.email || '—'}<br /><small className="muted">{c.phone}</small></td>
                  <td className="num">{st?.tasks ?? 0}</td>
                  <td className="num">{formatHours(st?.seconds ?? 0)}</td>
                  <td>
                    {canEdit ? (
                      <select className={'pill ' + STATUS_PILL[c.status]} value={c.status} onChange={(e) => clientsService.update(c.id, { status: e.target.value as ClientStatus })}>
                        {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : (
                      <span className={'pill ' + STATUS_PILL[c.status]}>{STATUS_LABEL[c.status]}</span>
                    )}
                  </td>
                  <td className="row-actions">{canEdit && <button onClick={() => handleEdit(c)}>Editar</button>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
