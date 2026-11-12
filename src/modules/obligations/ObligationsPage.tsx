import React, { useEffect, useMemo, useState } from 'react'
import { obligationsService, obligationSemaphore, completeObligation, reassignObligation } from './obligationsService'
import { useSemaphoreSettings } from '../calendar/semaphoreSettings'
import { clientsService } from '../clients/clientsService'
import { useUsers } from '../users/useUsers'
import { useAuth } from '../../hooks/useAuth'
import { can } from '../../services/permissions'
import { Obligation, ObligationStatus, Client } from '../../models'

const emptyForm = { clientId: '', name: '', status: 'PENDING' as ObligationStatus, dueDate: '', assignedUserId: '' }
const STATUS_LABEL: Record<ObligationStatus, string> = { PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', DONE: 'Cumplida', OVERDUE: 'Vencida' }

export default function ObligationsPage() {
  const { profile } = useAuth()
  const { settings } = useSemaphoreSettings()
  const canManage = can(profile?.role, 'obligations.manage')
  const [items, setItems] = useState<Obligation[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const users = useUsers()
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [filters, setFilters] = useState({ clientId: '', status: '', assignedUserId: '', period: '' })
  const [historyId, setHistoryId] = useState<string | null>(null)

  useEffect(() => {
    const unsubO = obligationsService.subscribe((i) => { setItems(i); setLoading(false) })
    const unsubC = clientsService.subscribe(setClients)
    return () => { unsubO(); unsubC() }
  }, [])

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? '—'
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? '—'
  const filtered = useMemo(() => items.filter((o) =>
    (!filters.clientId || o.clientId === filters.clientId) &&
    (!filters.status || o.status === filters.status) &&
    (!filters.assignedUserId || o.assignedUserId === filters.assignedUserId) &&
    (!filters.period || o.dueDate?.slice(0, 7) === filters.period)
  ).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')), [items, filters])

  async function perform(id: string, action: () => Promise<unknown>) {
    setError('')
    setBusyId(id)
    try { await action() }
    catch (e) { setError(e instanceof Error ? e.message : 'No fue posible guardar el cambio') }
    finally { setBusyId(null) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !canManage) return
    await perform('new', async () => {
      await obligationsService.create({ ...form, assignedBy: profile.id, assignmentHistory: [], completionHistory: [] })
      setForm(emptyForm)
    })
  }

  const changeStatus = (o: Obligation, status: ObligationStatus) => {
    if (!profile || busyId) return
    if (status === 'DONE') {
      void perform(o.id, () => completeObligation(o.id, profile.id, profile.name))
    } else {
      void perform(o.id, () => obligationsService.update(o.id, { status }))
    }
  }

  const changeAssignee = (o: Obligation, nextId: string) => {
    if (!profile || !canManage || !nextId || nextId === o.assignedUserId || busyId) return
    void perform(o.id, () => reassignObligation(o.id, nextId, profile.id, profile.name))
  }

  return (
    <div className="module-page">
      <h1>Obligaciones</h1>
      <p className="module-note">Control de obligaciones fiscales por cliente, responsable y fecha límite.</p>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}

      {canManage && <form className="inline-form form-grid" onSubmit={handleSubmit}>
        <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
          <option value="">Cliente…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input placeholder="Nombre de la obligación" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required />
        <select value={form.assignedUserId} onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })} required>
          <option value="">Responsable…</option>
          {users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <button type="submit" disabled={busyId !== null}>Crear obligación</button>
      </form>}

      <div className="inline-form form-grid" aria-label="Filtros de obligaciones">
        <select aria-label="Filtrar por cliente" value={filters.clientId} onChange={(e) => setFilters({ ...filters, clientId: e.target.value })}>
          <option value="">Todos los clientes</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Filtrar por estado" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Filtrar por responsable" value={filters.assignedUserId} onChange={(e) => setFilters({ ...filters, assignedUserId: e.target.value })}>
          <option value="">Todos los responsables</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <input aria-label="Filtrar por periodo" type="month" value={filters.period} onChange={(e) => setFilters({ ...filters, period: e.target.value })} />
        <button type="button" onClick={() => setFilters({ clientId: '', status: '', assignedUserId: '', period: '' })}>Limpiar filtros</button>
      </div>
      <p>{filtered.length} obligación(es) encontrada(s)</p>

      {loading ? <p>Cargando…</p> : (
        <table className="data-table">
          <thead><tr><th></th><th>Obligación</th><th>Cliente</th><th>Responsable</th><th>Fecha límite</th><th>Estado</th><th>Cumplimiento / historial</th></tr></thead>
          <tbody>
            {filtered.map((o) => {
              const allowed = canManage || o.assignedUserId === profile?.id
              return <tr key={o.id}>
                <td><span className={'semaphore ' + obligationSemaphore(o.dueDate, o.status, settings)} /></td>
                <td>{o.name}</td>
                <td>{clientName(o.clientId)}</td>
                <td>{canManage ? <select aria-label={'Responsable de ' + o.name} disabled={busyId !== null || o.status === 'DONE'} value={o.assignedUserId} onChange={(e) => changeAssignee(o, e.target.value)}>
                  <option value="">Sin responsable</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select> : userName(o.assignedUserId)}</td>
                <td>{o.dueDate}</td>
                <td>{allowed && o.status !== 'DONE' ? <select aria-label={'Estado de ' + o.name} disabled={busyId !== null} value={o.status} onChange={(e) => changeStatus(o, e.target.value as ObligationStatus)}>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select> : <span className="pill neutral">{STATUS_LABEL[o.status]}</span>}</td>
                <td>
                  {o.completedAt ? <div>Completada: {new Date(o.completedAt).toLocaleString('es-MX')}<div>Por: {o.completedByName || userName(o.completedBy || '')}</div></div> : '—'}
                  <button type="button" onClick={() => setHistoryId(historyId === o.id ? null : o.id)}> {historyId === o.id ? 'Ocultar' : 'Ver'} historial</button>
                  {historyId === o.id && <div>
                    <strong>Reasignaciones</strong>
                    {(o.assignmentHistory || []).length === 0 ? <p>Sin reasignaciones registradas.</p> : <ul>{o.assignmentHistory!.map((h, i) => <li key={i}>{userName(h.fromUserId)} → {userName(h.toUserId)} · {new Date(h.changedAt).toLocaleString('es-MX')} · Por {h.changedByName}</li>)}</ul>}
                    <strong>Cumplimientos</strong>
                    {(o.completionHistory || []).length === 0 ? <p>Sin registros de cumplimiento.</p> : <ul>{o.completionHistory!.map((h, i) => <li key={i}>{h.userName} · {new Date(h.completedAt).toLocaleString('es-MX')}</li>)}</ul>}
                  </div>}
                </td>
              </tr>
            })}
            {filtered.length === 0 && <tr><td colSpan={7}>No hay obligaciones con estos filtros.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  )
}
