import React, { useEffect, useMemo, useState } from 'react'
import { userCostsService } from './ratesService'
import { useUsers } from '../users/useUsers'
import { useAuth } from '../../hooks/useAuth'
import { can, ROLE_LABEL } from '../../services/permissions'
import { formatMoney } from '../../services/billing'
import { UserCost } from '../../models'

// HU-49: costo por hora de cada colaborador. Dato sensible: solo lo ven y editan
// Administrador y Superusuario (la página y las reglas de Firestore lo imponen).
export default function CostsPage() {
  const { profile } = useAuth()
  const users = useUsers()
  const [costs, setCosts] = useState<UserCost[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const allowed = can(profile?.role, 'costs.manage')

  useEffect(() => {
    if (!allowed) return
    return userCostsService.subscribe(setCosts, () => setError('No se pudieron cargar los costos. Verifica tus permisos.'))
  }, [allowed])

  const costOf = useMemo(() => new Map(costs.map((c) => [c.id, c.hourlyCost])), [costs])
  const rows = useMemo(
    () => users.filter((u) => u.active).sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name)),
    [users]
  )

  if (!profile) return null
  if (!allowed) return <div className="module-page"><h1>Costo por hora</h1><p>No tienes permiso para ver esta sección.</p></div>

  const valueFor = (id: string) => drafts[id] ?? (costOf.has(id) ? String(costOf.get(id)) : '')

  const save = async (id: string) => {
    const n = Number(drafts[id])
    if (!Number.isFinite(n) || n < 0) { setError('El costo debe ser un número igual o mayor a 0.'); return }
    setSavingId(id); setError('')
    try {
      await userCostsService.set(id, n, profile.id)
      setDrafts((d) => { const { [id]: _omit, ...rest } = d; return rest })
    } catch (err) {
      console.error('Error al guardar costo:', err)
      setError('No se pudo guardar el costo. Verifica tus permisos.')
    } finally { setSavingId(null) }
  }

  return (
    <div className="module-page">
      <h1>Costo por hora</h1>
      <p className="page-subtitle">Lo que le cuesta a la empresa cada hora de un colaborador. Solo visible para Administrador y Superusuario.</p>
      {error && <p role="alert" className="overdue">{error}</p>}

      <table className="data-table">
        <thead><tr><th>Colaborador</th><th>Rol</th><th className="num">Costo actual</th><th style={{ width: 220 }}>Nuevo costo / hora (MXN)</th><th></th></tr></thead>
        <tbody>
          {rows.map((u) => {
            const dirty = drafts[u.id] !== undefined && drafts[u.id] !== String(costOf.get(u.id) ?? '')
            return (
              <tr key={u.id}>
                <td>{u.name}<br /><small className="muted">{u.position ?? ''}</small></td>
                <td>{ROLE_LABEL[u.role]}</td>
                <td className="num">{costOf.has(u.id) ? formatMoney(costOf.get(u.id)!) : <span className="muted">Sin definir</span>}</td>
                <td><input type="number" min="0" step="0.01" value={valueFor(u.id)} onChange={(e) => setDrafts({ ...drafts, [u.id]: e.target.value })} style={{ width: '100%' }} /></td>
                <td className="row-actions"><button disabled={!dirty || savingId === u.id} onClick={() => save(u.id)}>Guardar</button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
