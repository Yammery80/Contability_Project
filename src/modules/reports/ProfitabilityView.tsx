import React from 'react'
import { ProfitabilityReport } from './profitability'
import { formatClock, formatHours, formatMoney } from '../../services/billing'

const pct = (n: number | null) => (n === null ? '—' : `${n.toFixed(1)} %`)

interface Props {
  report: ProfitabilityReport
  clientName: (id: string) => string
  userName: (id: string) => string
}

// HU-50 (costo operativo) y HU-51 (margen de utilidad por cliente y periodo).
export default function ProfitabilityView({ report, clientName, userName }: Props) {
  const { employees, clients, totals } = report

  if (employees.length === 0) return <p className="module-note">Sin registros de tiempo para estos filtros.</p>

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card"><span className="stat-label">Ingreso estimado</span><span className="stat-value">{formatMoney(totals.revenue)}</span></div>
        <div className="stat-card"><span className="stat-label">Costo operativo</span><span className="stat-value">{formatMoney(totals.cost)}</span><span className="stat-sub">{formatHours(totals.seconds)} trabajadas</span></div>
        <div className="stat-card highlight"><span className="stat-label">Utilidad</span><span className={'stat-value' + (totals.profit < 0 ? ' overdue' : '')}>{formatMoney(totals.profit)}</span><span className="stat-sub">margen {pct(totals.marginPct)}</span></div>
      </div>

      {!totals.complete && (
        <p className="footnote" role="status">
          ⚠ Faltan tarifas o costos por hora para algunas horas: no suman al ingreso o al costo, así que los
          números de las filas marcadas están incompletos.
        </p>
      )}

      <h4>Margen de utilidad por cliente</h4>
      <table className="report-table">
        <thead><tr><th>Cliente</th><th>Horas</th><th>Ingreso</th><th>Costo</th><th>Utilidad</th><th>Margen</th></tr></thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.clientId}>
              <td>
                {clientName(c.clientId)}
                {c.unpricedSeconds > 0 && <><br /><small className="overdue">Sin tarifa en {formatHours(c.unpricedSeconds)}</small></>}
                {c.uncostedSeconds > 0 && <><br /><small className="overdue">Sin costo por hora en {formatHours(c.uncostedSeconds)}</small></>}
              </td>
              <td>{formatClock(c.seconds)}</td>
              <td>{formatMoney(c.revenue)}</td>
              <td>{formatMoney(c.cost)}</td>
              <td className={c.profit < 0 ? 'overdue' : ''}>{formatMoney(c.profit)}</td>
              <td className={c.marginPct !== null && c.marginPct < 0 ? 'overdue' : ''}>{pct(c.marginPct)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><th>Total</th><th>{formatClock(totals.seconds)}</th><th>{formatMoney(totals.revenue)}</th><th>{formatMoney(totals.cost)}</th><th>{formatMoney(totals.profit)}</th><th>{pct(totals.marginPct)}</th></tr>
        </tfoot>
      </table>

      <h4 style={{ marginTop: '1.4rem' }}>Costo operativo por colaborador</h4>
      <table className="report-table">
        <thead><tr><th>Colaborador</th><th>Horas</th><th>Costo por hora</th><th>Costo operativo</th></tr></thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.userId}>
              <td>{userName(e.userId)}</td>
              <td>{formatClock(e.seconds)}</td>
              <td>{e.hourlyCost === null ? <span className="overdue">Sin definir</span> : formatMoney(e.hourlyCost)}</td>
              <td>{formatMoney(e.operatingCost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="footnote">
        Ingreso = horas × tarifa vigente del cliente en la fecha trabajada. Costo = horas × costo por hora del colaborador.
        Margen = utilidad ÷ ingreso.
      </p>
    </>
  )
}
