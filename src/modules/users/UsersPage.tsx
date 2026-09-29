import React, { useEffect, useState } from 'react'
import { usersService } from './usersService'
import { AppUser, Role } from '../../models'

const ROLES: Role[] = ['CLIENT', 'OPERATOR', 'SUPERVISOR', 'SUPERUSER']

const emptyForm = { name: '', email: '', role: 'OPERATOR' as Role }

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    const unsub = usersService.subscribe((items) => {
      setUsers(items)
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
      await usersService.update(editingId, form)
    } else {
      // Nota: crear el usuario aquí sólo guarda su perfil en Firestore.
      // El alta en Firebase Authentication (para que pueda iniciar sesión)
      // se hace aparte, típicamente con una Cloud Function o desde la consola,
      // usando este mismo email para vincular el uid.
      await usersService.create({ ...form, active: true, createdAt: Date.now() })
    }
    resetForm()
  }

  const handleEdit = (u: AppUser) => {
    setForm({ name: u.name, email: u.email, role: u.role })
    setEditingId(u.id)
  }

  const toggleActive = async (u: AppUser) => {
    await usersService.update(u.id, { active: !u.active })
  }

  return (
    <div className="module-page">
      <h1>Usuarios</h1>

      <form className="inline-form" onSubmit={handleSubmit}>
        <input
          placeholder="Nombre"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          placeholder="Correo"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button type="submit">{editingId ? 'Guardar' : 'Crear usuario'}</button>
        {editingId && <button type="button" onClick={resetForm}>Cancelar</button>}
      </form>

      {loading ? (
        <p>Cargando…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>
                  <span className={'status-pill ' + (u.active ? 'ok' : 'off')}>
                    {u.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="row-actions">
                  <button onClick={() => handleEdit(u)}>Editar</button>
                  <button onClick={() => toggleActive(u)}>{u.active ? 'Desactivar' : 'Activar'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
