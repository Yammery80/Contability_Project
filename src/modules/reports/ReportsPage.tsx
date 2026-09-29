import React, { useState } from 'react'

// Estructura base de reportes. Las fórmulas de rentabilidad reales aún no
// están definidas, así que esta sección usa datos mock según el brief.
const TABS = ['Horas', 'Clientes', 'Proyectos', 'Actividades', 'Rentabilidad'] as const
type Tab = typeof TABS[number]

const MOCK_PROFITABILITY = [
  { client: 'Cliente demo A', revenue: 45000, cost: 28000 },
  { client: 'Cliente demo B', revenue: 32000, cost: 19500 },
  { client: 'Cliente demo C', revenue: 18000, cost: 21000 },
]

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('Horas')

  return (
    <div className="module-page">
      <h1>Reportes</h1>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={'tab' + (tab === t ? ' active' : '')} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Rentabilidad' ? (
        <>
          <p className="module-note">Datos de ejemplo — las fórmulas definitivas de rentabilidad están pendientes.</p>
          <table className="data-table">
            <thead><tr><th>Cliente</th><th>Ingresos</th><th>Costo</th><th>Margen</th></tr></thead>
            <tbody>
              {MOCK_PROFITABILITY.map((r) => {
                const margin = r.revenue - r.cost
                return (
                  <tr key={r.client}>
                    <td>{r.client}</td>
                    <td>${r.revenue.toLocaleString()}</td>
                    <td>${r.cost.toLocaleString()}</td>
                    <td className={margin >= 0 ? 'positive' : 'negative'}>${margin.toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      ) : (
        <p className="module-note">Reporte de "{tab}" — estructura preparada; se conectará a datos reales de Firestore (horas, clientes, proyectos y actividades) en la siguiente iteración.</p>
      )}
    </div>
  )
}
