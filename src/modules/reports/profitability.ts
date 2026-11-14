import { ClientRate, TimeEntry, UserCost } from '../../models'
import { rateFor } from '../../services/billing'
import { entryDate } from '../../services/period'

// HU-50 y HU-51: costo operativo y margen de utilidad.
//
//   costo operativo de un registro = horas × costo por hora del colaborador (HU-49)
//   ingreso de un registro         = horas × tarifa vigente del cliente en esa fecha (HU-48)
//   utilidad = ingreso − costo        margen % = utilidad ÷ ingreso × 100
//
// Solo cuentan registros detenidos (los que ya tienen duración final).

export interface EmployeeCostRow {
  userId: string
  seconds: number
  hourlyCost: number | null // null = el colaborador no tiene costo definido
  operatingCost: number
}

export interface ClientProfitRow {
  clientId: string
  seconds: number
  revenue: number
  cost: number
  profit: number
  marginPct: number | null // null = sin ingreso, el margen no se puede calcular
  unpricedSeconds: number // horas sin tarifa del cliente (no generan ingreso)
  uncostedSeconds: number // horas de colaboradores sin costo definido (no generan costo)
  complete: boolean // false si falta alguna tarifa o algún costo
}

export interface ProfitabilityReport {
  employees: EmployeeCostRow[]
  clients: ClientProfitRow[]
  totals: { seconds: number; revenue: number; cost: number; profit: number; marginPct: number | null; complete: boolean }
}

export const marginOf = (revenue: number, profit: number): number | null => (revenue > 0 ? (profit / revenue) * 100 : null)

export function buildProfitability(entries: TimeEntry[], rates: ClientRate[], costs: UserCost[]): ProfitabilityReport {
  const costOf = new Map(costs.map((c) => [c.id, c.hourlyCost]))
  const stopped = entries.filter((e) => e.status === 'STOPPED')

  const byEmployee = new Map<string, EmployeeCostRow>()
  const byClient = new Map<string, ClientProfitRow>()

  for (const e of stopped) {
    const hours = e.duration / 3600
    const hourlyCost = costOf.get(e.userId)
    const rate = rateFor(rates, e.clientId, entryDate(e))
    const cost = hourlyCost === undefined ? 0 : hours * hourlyCost
    const revenue = rate === undefined ? 0 : hours * rate

    const emp = byEmployee.get(e.userId) ?? { userId: e.userId, seconds: 0, hourlyCost: hourlyCost ?? null, operatingCost: 0 }
    emp.seconds += e.duration
    emp.operatingCost += cost
    byEmployee.set(e.userId, emp)

    const cli = byClient.get(e.clientId) ?? {
      clientId: e.clientId, seconds: 0, revenue: 0, cost: 0, profit: 0, marginPct: null,
      unpricedSeconds: 0, uncostedSeconds: 0, complete: true,
    }
    cli.seconds += e.duration
    cli.revenue += revenue
    cli.cost += cost
    if (rate === undefined) cli.unpricedSeconds += e.duration
    if (hourlyCost === undefined) cli.uncostedSeconds += e.duration
    byClient.set(e.clientId, cli)
  }

  const clients = [...byClient.values()]
    .map((c) => {
      const profit = c.revenue - c.cost
      return { ...c, profit, marginPct: marginOf(c.revenue, profit), complete: c.unpricedSeconds === 0 && c.uncostedSeconds === 0 }
    })
    .sort((a, b) => b.profit - a.profit)

  const employees = [...byEmployee.values()].sort((a, b) => b.operatingCost - a.operatingCost)

  const revenue = clients.reduce((s, c) => s + c.revenue, 0)
  const cost = clients.reduce((s, c) => s + c.cost, 0)
  const profit = revenue - cost
  return {
    employees,
    clients,
    totals: {
      seconds: clients.reduce((s, c) => s + c.seconds, 0),
      revenue, cost, profit,
      marginPct: marginOf(revenue, profit),
      complete: clients.every((c) => c.complete),
    },
  }
}
