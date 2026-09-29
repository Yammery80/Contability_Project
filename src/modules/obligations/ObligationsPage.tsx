import React, { useEffect, useState } from 'react'
import { obligationsService, obligationSemaphore } from './obligationsService'
import { clientsService } from '../clients/clientsService'
import { usersService } from '../users/usersService'
import { Obligation, ObligationStatus, Client, AppUser } from '../../models'

const emptyForm = { clientId: '', name: '', status: 'PENDING' as ObligationStatus, dueDate: '', assignedUserId: '' }
const STATUS_LABEL: Record<ObligationStatus, string> = { PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', DONE: 'Cumplida', OVERDUE: 'Vencida' }

export default function ObligationsPage() {
  const [items, setItems] = useState<Obligation[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    const unsubO = obligationsService.subscribe((i) => { setItems(i); setLoading(false) })
    const unsubC = clientsService.subscribe(setClients)
    const unsubU = usersService.subscribe(setUsers)
    return () => { unsubO(); unsubC(); unsubU() }
  }, [])

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? '—'
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? '—'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await obligationsService.create(form)
    setForm(emptyForm)
  }

  return (
    <div className="module-page">
      <h1>Obligaciones</h1>
      <p className="module-note">Estructura preliminar con datos de ejemplo — las reglas fiscales reales se integrarán más adelante.</p>

      <form className="inline-form form-grid" onSubmit={handleSubmit}>
        <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
          <option value="">Cliente…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input placeholder="Nombre de la obligación" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required />
        <select value={form.assignedUserId} onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}>
          <option value="">Responsable…</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <button type="submit">Crear obligación</button>
      </form>

      {loading ? <p>Cargando…</p> : (
        <table className="data-table">
          <thead><tr><th></th><th>Obligación</th><th>Cliente</th><th>Responsable</th><th>Fecha límite</th><th>Estado</th></tr></thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id}>
                <td><span className={'semaphore ' + obligationSemaphore(o.dueDate, o.status)} /></td>
                <td>{o.name}</td>
                <td>{clientName(o.clientId)}</td>
                <td>{userName(o.assignedUserId)}</td>
                <td>{o.dueDate}</td>
                <td>
                  <select value={o.status} onChange={(e) => obligationsService.update(o.id, { status: e.target.value as ObligationStatus })}>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
