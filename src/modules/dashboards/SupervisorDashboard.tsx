import React, { useEffect, useState } from 'react'
import { activitiesService, ActivityItem } from '../../services/activitiesService'
import { useAuth } from '../../hooks/useAuth'

export default function SupervisorDashboard() {
  const { profile } = useAuth()
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const unsubscribe = activitiesService.subscribeToTeamActivities((data) => {
      setActivities(data)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const filteredActivities = activities.filter((act) =>
    `${act.userName} ${act.taskTitle} ${act.action}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="module-page">
      <h1>Monitoreo de Actividades del Equipo (HU-09)</h1>
      <p className="page-subtitle">Vista exclusiva para Supervisores para supervisar el avance de los Operadores</p>

      <div className="toolbar" style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Buscar por operador, tarea o acción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p>Cargando actividades del equipo...</p>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Operador / Miembro</th>
                <th>Acción realizada</th>
                <th>Tarea / Contexto</th>
                <th>Fecha y Hora</th>
              </tr>
            </thead>
            <tbody>
              {filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted" style={{ textAlign: 'center' }}>
                    No se registraron actividades recientes.
                  </td>
                </tr>
              ) : (
                filteredActivities.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.userName}</strong></td>
                    <td><span className="pill neutral">{item.action}</span></td>
                    <td>{item.taskTitle}</td>
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}