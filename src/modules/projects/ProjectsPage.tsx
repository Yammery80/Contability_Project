import React, { useEffect, useState } from 'react'
import { projectsService } from './projectsService'
import { clientsService } from '../clients/clientsService'
import { usersService } from '../users/usersService'
import { useAuth } from '../../hooks/useAuth'
import { can } from '../../services/permissions'
import { Project, ProjectStatus, Client, AppUser } from '../../models'

const emptyForm = {
  clientId: '', name: '', description: '', status: 'PLANNED' as ProjectStatus,
  startDate: '', endDate: '', supervisorId: '',
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNED: 'Planeado', ACTIVE: 'Activo', COMPLETED: 'Completado', CANCELLED: 'Cancelado',
}

export default function ProjectsPage() {
  const { profile } = useAuth()
  const canEdit = can(profile?.role, 'projects.edit') // solo Administrador / Superusuario
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [supervisors, setSupervisors] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    const unsubP = projectsService.subscribe((items) => { setProjects(items); setLoading(false) })
    const unsubC = clientsService.subscribe(setClients)
    const unsubU = usersService.subscribe((items) => setSupervisors(items.filter((u) => u.role === 'SUPERVISOR' || u.role === 'ADMIN' || u.role === 'SUPERUSER')))
    return () => { unsubP(); unsubC(); unsubU() }
  }, [])

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? '—'
  const supervisorName = (id: string) => supervisors.find((s) => s.id === id)?.name ?? '—'

  const resetForm = () => { setForm(emptyForm); setEditingId(null) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId) await projectsService.update(editingId, form)
    else await projectsService.create(form)
    resetForm()
  }

  const handleEdit = (p: Project) => {
    setForm({ clientId: p.clientId, name: p.name, description: p.description, status: p.status, startDate: p.startDate, endDate: p.endDate, supervisorId: p.supervisorId })
    setEditingId(p.id)
  }

  return (
    <div className="module-page">
      <h1>Proyectos</h1>

      {canEdit && <form className="inline-form form-grid" onSubmit={handleSubmit}>
        <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
          <option value="">Cliente…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input placeholder="Nombre del proyecto" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={form.supervisorId} onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}>
          <option value="">Supervisor…</option>
          {supervisors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        <button type="submit">{editingId ? 'Guardar' : 'Crear proyecto'}</button>
        {editingId && <button type="button" onClick={resetForm}>Cancelar</button>}
      </form>}

      {loading ? <p>Cargando…</p> : (
        <table className="data-table">
          <thead><tr><th>Proyecto</th><th>Cliente</th><th>Supervisor</th><th>Estado</th><th>Fechas</th><th></th></tr></thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>{p.name}<br /><small>{p.description}</small></td>
                <td>{clientName(p.clientId)}</td>
                <td>{supervisorName(p.supervisorId)}</td>
                <td><span className={'status-pill status-' + p.status.toLowerCase()}>{STATUS_LABEL[p.status]}</span></td>
                <td><small>{p.startDate} → {p.endDate}</small></td>
                <td className="row-actions">{canEdit && <button onClick={() => handleEdit(p)}>Editar</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
