import React, { useEffect, useState } from 'react'
import { clientsService } from './clientsService'
import { Client, ClientType } from '../../models'

const emptyForm = {
  name: '',
  type: 'PHYSICAL_PERSON' as ClientType,
  email: '',
  phone: '',
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const unsub = clientsService.subscribe((items) => {
      setClients(items)
      setLoading(false)
    })
    return unsub
  }, [])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId) {
      await clientsService.update(editingId, form)
    } else {
      await clientsService.create({ ...form, status: 'ACTIVE', createdAt: Date.now() })
    }
    resetForm()
  }

  const handleEdit = (c: Client) => {
    setForm({ name: c.name, type: c.type, email: c.email, phone: c.phone })
    setEditingId(c.id)
  }

  const toggleStatus = async (c: Client) => {
    await clientsService.update(c.id, { status: c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })
  }

  const visible = clients.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="module-page">
      <h1>Clientes <span className="counter">({clients.length} / ~120 esperados)</span></h1>

      <form className="inline-form" onSubmit={handleSubmit}>
        <input placeholder="Nombre o razón social" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ClientType })}>
          <option value="PHYSICAL_PERSON">Persona física</option>
          <option value="LEGAL_ENTITY">Persona moral</option>
        </select>
        <input placeholder="Correo" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input placeholder="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <button type="submit">{editingId ? 'Guardar' : 'Crear cliente'}</button>
        {editingId && <button type="button" onClick={resetForm}>Cancelar</button>}
      </form>

      <input className="search-input" placeholder="Buscar cliente…" value={filter} onChange={(e) => setFilter(e.target.value)} />

      {loading ? (
        <p>Cargando…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Nombre</th><th>Tipo</th><th>Contacto</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.type === 'PHYSICAL_PERSON' ? 'Persona física' : 'Persona moral'}</td>
                <td>{c.email}<br /><small>{c.phone}</small></td>
                <td><span className={'status-pill ' + (c.status === 'ACTIVE' ? 'ok' : 'off')}>{c.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</span></td>
                <td className="row-actions">
                  <button onClick={() => handleEdit(c)}>Editar</button>
                  <button onClick={() => toggleStatus(c)}>{c.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
