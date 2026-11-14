import { describe, expect, it } from 'vitest'
import { buildProfitability, marginOf } from './profitability'
import { ClientRate, TimeEntry, UserCost } from '../../models'

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime()
const entry = (userId: string, clientId: string, when: number, hours: number, status: TimeEntry['status'] = 'STOPPED'): TimeEntry => ({
  id: Math.random().toString(), userId, clientId, projectId: 'p', taskId: 't',
  startTime: when - hours * 3600000, endTime: when, duration: hours * 3600, description: '', type: 'MANUAL', status,
})
const rate = (clientId: string, hourlyRate: number, validFrom: string, validTo = ''): ClientRate =>
  ({ id: clientId + validFrom, clientId, hourlyRate, validFrom, validTo, createdAt: 0, createdBy: 'a' })
const cost = (id: string, hourlyCost: number): UserCost => ({ id, hourlyCost, updatedAt: 0, updatedBy: 'a' })

const RATES = [rate('c1', 500, '2026-01-01'), rate('c2', 300, '2026-01-01')]
const COSTS = [cost('ana', 200), cost('beto', 100)]
const D = at(2026, 5, 10)

describe('buildProfitability (HU-50 / HU-51)', () => {
  it('costo operativo = horas × costo por hora, por colaborador', () => {
    const r = buildProfitability([entry('ana', 'c1', D, 3), entry('ana', 'c2', D, 1), entry('beto', 'c1', D, 2)], RATES, COSTS)
    const ana = r.employees.find((e) => e.userId === 'ana')!
    const beto = r.employees.find((e) => e.userId === 'beto')!
    expect(ana.operatingCost).toBe(800)
    expect(ana.hourlyCost).toBe(200)
    expect(beto.operatingCost).toBe(200)
  })

  it('margen por cliente: ingreso, costo, utilidad y porcentaje', () => {
    // c1: 5 h → ingreso 2500; costo ana 3 h×200 + beto 2 h×100 = 800; utilidad 1700; margen 68 %
    const r = buildProfitability([entry('ana', 'c1', D, 3), entry('beto', 'c1', D, 2)], RATES, COSTS)
    const c1 = r.clients[0]
    expect(c1).toMatchObject({ clientId: 'c1', revenue: 2500, cost: 800, profit: 1700, complete: true })
    expect(c1.marginPct).toBeCloseTo(68, 5)
    expect(r.totals).toMatchObject({ revenue: 2500, cost: 800, profit: 1700 })
  })

  it('un cliente con pérdida tiene utilidad y margen negativos', () => {
    const r = buildProfitability([entry('ana', 'c2', D, 3)], RATES, COSTS) // ingreso 900, costo 600 → +300
    expect(r.clients[0].profit).toBe(300)
    const loss = buildProfitability([entry('ana', 'c2', D, 3)], [rate('c2', 100, '2026-01-01')], COSTS) // ingreso 300, costo 600
    expect(loss.clients[0].profit).toBe(-300)
    expect(loss.clients[0].marginPct).toBeCloseTo(-100, 5)
  })

  it('sin tarifa: no hay ingreso, el margen es null y la fila queda incompleta', () => {
    const r = buildProfitability([entry('ana', 'c9', D, 2)], RATES, COSTS)
    expect(r.clients[0]).toMatchObject({ revenue: 0, cost: 400, marginPct: null, unpricedSeconds: 7200, complete: false })
    expect(r.totals.complete).toBe(false)
  })

  it('sin costo por hora: no hay costo y la fila queda incompleta', () => {
    const r = buildProfitability([entry('nuevo', 'c1', D, 2)], RATES, COSTS)
    expect(r.clients[0]).toMatchObject({ revenue: 1000, cost: 0, uncostedSeconds: 7200, complete: false })
    expect(r.employees[0].hourlyCost).toBeNull()
  })

  it('ignora cronómetros sin detener y usa la tarifa de la fecha trabajada', () => {
    const rates = [rate('c1', 400, '2026-01-01', '2026-05-31'), rate('c1', 600, '2026-06-01')]
    const r = buildProfitability(
      [entry('ana', 'c1', at(2026, 5, 20), 1), entry('ana', 'c1', at(2026, 6, 20), 1), entry('ana', 'c1', D, 50, 'RUNNING')],
      rates, COSTS
    )
    expect(r.clients[0].revenue).toBe(1000)
    expect(r.totals.seconds).toBe(7200)
  })

  it('marginOf devuelve null sin ingreso', () => {
    expect(marginOf(0, -50)).toBeNull()
    expect(marginOf(200, 50)).toBe(25)
  })
})
