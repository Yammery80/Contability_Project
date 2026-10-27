import React, { useEffect, useMemo, useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../../firebase/config'
import { createUserWithPassword, authErrorMessage } from '../../firebase/createAuthAccount'
import { usersService } from './usersService'
import { useAuth } from '../../hooks/useAuth'
import { ROLE_LABEL, ROLE_SUMMARY, assignableRoles, canManageUser } from '../../services/permissions'
import { AppUser, Role } from '../../models'

const emptyForm = { name: '', email: '', phone: '', position: '', role: 'OPERATOR' as Role, password: '', confirm: '' }

// Contraseña aleatoria sin caracteres ambiguos (0/O, 1/l/I).
function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint32Array(length))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

export default function UsersPage() {
  const { profile } = useAuth()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')

  useEffect(() => {
    return usersService.subscribe((items) => { setUsers(items); setLoading(false) })
  }, [])

  const roles = assignableRoles(profile?.role)
  const editingSelf = editingId === profile?.id
  const set = (patch: Partial<typeof emptyForm>) => setForm((f) => ({ ...f, ...patch }))

  const openCreate = () => {
    setForm({ ...emptyForm, role: roles.includes('OPERATOR') ? 'OPERATOR' : roles[0] })
    setEditingId(null); setError(null); setNotice(null); setShowPassword(false); setShowForm(true)
  }

  const openEdit = (u: AppUser) => {
    setForm({ name: u.name, email: u.email, phone: u.phone ?? '', position: u.position ?? '', role: u.role, password: '', confirm: '' })
    setEditingId(u.id); setError(null); setNotice(null); setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); setError(null) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null); setNotice(null)
    const name = form.name.trim()
    const email = form.email.trim().toLowerCase()
    if (!name) return setError('El nombre es obligatorio.')

    setBusy(true)
    try {
      if (editingId) {
        await usersService.update(editingId, { name, phone: form.phone.trim(), position: form.position.trim(), ...(editingSelf ? {} : { role: form.role }) })
        setNotice('Cambios guardados.')
        closeForm()
        return
      }

      // --- Alta de usuario nuevo ---
      if (!email) return setError('El correo es obligatorio.')
      if (users.some((u) => u.email.toLowerCase() === email)) return setError('Ya existe un usuario con ese correo.')
      if (form.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
      if (form.password !== form.confirm) return setError('Las contraseñas no coinciden.')

      await createUserWithPassword(
        { name, email, phone: form.phone.trim(), position: form.position.trim(), role: form.role, active: true, createdAt: Date.now(), mustChangePassword: true },
        form.password
      )
      setNotice(`Usuario creado. ${name} ya puede iniciar sesión con ${email} y la contraseña que le asignaste.`)
      closeForm()
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = (u: AppUser) => usersService.update(u.id, { active: !u.active })

  const resetPassword = async (u: AppUser) => {
    setError(null); setNotice(null)
    try {
      await sendPasswordResetEmail(auth, u.email)
      setNotice(`Se envió un correo a ${u.email} para restablecer su contraseña.`)
    } catch (err) {
      setError(authErrorMessage(err))
    }
  }

  const visible = useMemo(() => users
    .filter((u) => roleFilter === 'ALL' || u.role === roleFilter)
    .filter((u) => statusFilter === 'ALL' || (statusFilter === 'ACTIVE') === u.active)
    .filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase())),
  [users, roleFilter, statusFilter, search])

  const summary = ROLE_SUMMARY[form.role]

  return (
    <div className="module-page">
      <h1>Usuarios</h1>
      <p className="page-subtitle">Da de alta a tu equipo y define qué puede ver y hacer cada rol</p>

      {notice && <div className="alert alert-success">{notice}</div>}
      {error && !showForm && <div className="alert alert-error">{error}</div>}

      <div className="toolbar">
        <input placeholder="Buscar por nombre o correo…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as 'ALL' | Role)}>
          <option value="ALL">Rol: Todos</option>
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}>
          <option value="ALL">Estado: Todos</option>
          <option value="ACTIVE">Activos</option>
          <option value="INACTIVE">Inactivos</option>
        </select>
        <button className="btn push-right" onClick={() => (showForm ? closeForm() : openCreate())}>{showForm ? 'Cancelar' : '+ Nuevo usuario'}</button>
      </div>

      {showForm && (
        <form className="card user-form" onSubmit={handleSubmit}>
          <h2>{editingId ? 'Editar usuario' : 'Nuevo usuario'}</h2>
          <div className="form-grid">
            <label className="form-field"><span>Nombre completo *</span>
              <input value={form.name} onChange={(e) => set({ name: e.target.value })} required />
            </label>
            <label className="form-field"><span>Correo electrónico * {editingId && '(es su usuario de acceso)'}</span>
              <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} disabled={!!editingId} required />
            </label>
            <label className="form-field"><span>Teléfono</span>
              <input value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
            </label>
            <label className="form-field"><span>Puesto</span>
              <input value={form.position} onChange={(e) => set({ position: e.target.value })} placeholder="Ej. Contador Senior" />
            </label>
            <label className="form-field"><span>Rol *</span>
              <select value={form.role} onChange={(e) => set({ role: e.target.value as Role })} disabled={editingSelf}>
                {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </label>
          </div>

          {!editingId && (
            <div className="form-grid" style={{ marginTop: '.8rem' }}>
              <label className="form-field"><span>Contraseña * (mínimo 8 caracteres)</span>
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => set({ password: e.target.value })} autoComplete="new-password" required />
              </label>
              <label className="form-field"><span>Confirmar contraseña *</span>
                <input type={showPassword ? 'text' : 'password'} value={form.confirm} onChange={(e) => set({ confirm: e.target.value })} autoComplete="new-password" required />
              </label>
              <div className="form-field password-tools">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { const p = generatePassword(); set({ password: p, confirm: p }); setShowPassword(true) }}>Generar contraseña</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPassword((v) => !v)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button>
              </div>
            </div>
          )}

          <div className="role-preview">
            <strong>Qué podrá hacer un {ROLE_LABEL[form.role]}</strong>
            <ul className="perm-list">
              {summary.can.map((t) => <li key={t} className="perm-yes">{t}</li>)}
              {summary.cannot.map((t) => <li key={t} className="perm-no">{t}</li>)}
            </ul>
          </div>

          {error && <div className="alert alert-error" style={{ marginTop: '.8rem' }}>{error}</div>}
          <div className="add-row" style={{ marginTop: '1rem' }}>
            <button className="btn" type="submit" disabled={busy}>{busy ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear usuario'}</button>
            <button className="btn btn-ghost" type="button" onClick={closeForm}>Cancelar</button>
          </div>
        </form>
      )}

      {loading ? <p>Cargando…</p> : (
        <table className="data-table">
          <thead><tr><th>Usuario</th><th>Correo</th><th>Teléfono</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={6} className="muted">No hay usuarios con estos filtros.</td></tr>}
            {visible.map((u) => {
              const manageable = canManageUser(profile?.role, u.role)
              const isSelf = u.id === profile?.id
              return (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong>{isSelf && <span className="muted"> (tú)</span>}<br /><small className="muted">{u.position}</small></td>
                  <td>{u.email}</td>
                  <td>{u.phone || '—'}</td>
                  <td><span className="pill neutral">{ROLE_LABEL[u.role]}</span></td>
                  <td><span className={'pill ' + (u.active ? 'ok' : 'off')}>{u.active ? 'Activo' : 'Inactivo'}</span></td>
                  <td className="row-actions">
                    {manageable && <button onClick={() => openEdit(u)}>Editar</button>}
                    {manageable && !isSelf && <button onClick={() => toggleActive(u)}>{u.active ? 'Desactivar' : 'Activar'}</button>}
                    {manageable && <button onClick={() => resetPassword(u)}>Restablecer contraseña</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
