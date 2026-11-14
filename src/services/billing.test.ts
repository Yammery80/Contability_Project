import { describe, expect, it } from 'vitest'
import { estimatedCharge, rateFor, unpricedSeconds, validateRatePeriod } from './billing'
import { ClientRate, TimeEntry } from '../models'

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime()
const rate = (clientId: string, hourlyRate: number, validFrom: string, validTo = ''): ClientRate => ({
  id: `${clientId}-${validFrom}`, clientId, hourlyRate, validFrom, validTo, createdAt: 0, createdBy: 'a',
})
const entry = (clientId: string, when: number, seconds: number): TimeEntry => ({
  id: Math.random().toString(), userId: 'u', clientId, projectId: 'p', taskId: 't',
  startTime: when - seconds * 1000, endTime: when, duration: seconds, description: '', type: 'MANUAL', status: 'STOPPED',
})

const RATES = [
  rate('c1', 400, '2026-01-01', '2026-06-30'),
  rate('c1', 500, '2026-07-01'),
  rate('c2', 300, '2026-01-01'),
]

describe('rateFor (HU-48)', () => {
  it('usa la tarifa vigente en la fecha trabajada', () => {
    expect(rateFor(RATES, 'c1', at(2026, 3, 15))).toBe(400)
    expect(rateFor(RATES, 'c1', at(2026, 9, 1))).toBe(500)
  })
  it('los extremos del periodo son inclusivos', () => {
    expect(rateFor(RATES, 'c1', at(2026, 6, 30))).toBe(400)
    expect(rateFor(RATES, 'c1', at(2026, 7, 1))).toBe(500)
    expect(rateFor(RATES, 'c1', at(2026, 1, 1))).toBe(400)
  })
  it('sin tarifa para esa fecha o cliente devuelve undefined', () => {
    expect(rateFor(RATES, 'c1', at(2025, 12, 31))).toBeUndefined()
    expect(rateFor(RATES, 'c9', at(2026, 3, 1))).toBeUndefined()
  })
})

describe('estimatedCharge / unpricedSeconds', () => {
  it('cobra cada registro con la tarifa de su fecha', () => {
    const entries = [entry('c1', at(2026, 3, 1), 3600), entry('c1', at(2026, 8, 1), 7200), entry('c2', at(2026, 8, 1), 1800)]
    expect(estimatedCharge(entries, RATES)).toBe(400 + 2 * 500 + 0.5 * 300)
  })
  it('excluye del cobro las horas sin tarifa y las reporta', () => {
    const entries = [entry('c1', at(2026, 3, 1), 3600), entry('c9', at(2026, 3, 1), 5400)]
    expect(estimatedCharge(entries, RATES)).toBe(400)
    expect(unpricedSeconds(entries, RATES)).toBe(5400)
  })
})

describe('validateRatePeriod', () => {
  const base = { clientId: 'c1', hourlyRate: 600 }
  it('acepta un periodo que no se traslapa', () => {
    expect(validateRatePeriod(RATES, { ...base, clientId: 'c2', validFrom: '2025-01-01', validTo: '2025-12-31' })).toBeNull()
  })
  it('rechaza traslapes, incluso contra una tarifa abierta', () => {
    expect(validateRatePeriod(RATES, { ...base, validFrom: '2026-08-01', validTo: '' })).toMatch(/traslapa/)
    expect(validateRatePeriod(RATES, { ...base, validFrom: '2026-06-15', validTo: '2026-07-15' })).toMatch(/traslapa/)
  })
  it('rechaza tarifa 0, sin fecha o con fin anterior al inicio', () => {
    expect(validateRatePeriod([], { ...base, hourlyRate: 0, validFrom: '2026-01-01', validTo: '' })).toMatch(/mayor a 0/)
    expect(validateRatePeriod([], { ...base, validFrom: '', validTo: '' })).toMatch(/desde cuándo/)
    expect(validateRatePeriod([], { ...base, validFrom: '2026-05-01', validTo: '2026-04-01' })).toMatch(/anterior/)
  })
})
