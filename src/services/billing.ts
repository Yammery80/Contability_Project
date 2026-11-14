import { AppUser, ClientRate, Role, TimeEntry } from '../models'
import { entryDate } from './period'

// Nivel del empleado (ver diseño "Registro de tiempos": Junior / Senior /
// Administrador). Se usa para etiquetar registros y para la distribución del
// tiempo; ya NO define el cobro (eso lo hacen las tarifas por cliente).
export type UserLevel = 'JUNIOR' | 'SENIOR' | 'ADMIN'

export const LEVEL_LABEL: Record<UserLevel, string> = {
  JUNIOR: 'Junior',
  SENIOR: 'Senior',
  ADMIN: 'Admin',
}

// SUPUESTO: el nivel se deduce del rol. Cuando la empresa defina cómo se
// asigna el nivel a cada colaborador, se cambia solo esta función.
export function levelForRole(role: Role | undefined): UserLevel {
  if (role === 'SUPERVISOR') return 'SENIOR'
  if (role === 'ADMIN' || role === 'SUPERUSER') return 'ADMIN'
  return 'JUNIOR'
}

export function entryLevel(entry: TimeEntry, users: AppUser[]): UserLevel {
  return levelForRole(users.find((u) => u.id === entry.userId)?.role)
}

// ===== Cobro estimado con tarifas reales por cliente y periodo (HU-48) =====

// Fecha local "YYYY-MM-DD" de un instante en ms.
export function toDateStr(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const OPEN_END = '9999-12-31'

// Tarifa del cliente vigente en esa fecha (ms). undefined = no hay tarifa definida.
export function rateFor(rates: ClientRate[], clientId: string, atMs: number): number | undefined {
  const day = toDateStr(atMs)
  return rates.find((r) => r.clientId === clientId && r.validFrom <= day && day <= (r.validTo || OPEN_END))?.hourlyRate
}

// El registro se cobra con la tarifa vigente del cliente en la fecha en que se trabajó.
export function estimatedCharge(entries: TimeEntry[], rates: ClientRate[]): number {
  return entries.reduce((sum, e) => {
    const rate = rateFor(rates, e.clientId, entryDate(e))
    return rate === undefined ? sum : sum + (e.duration / 3600) * rate
  }, 0)
}

// Segundos que no se pudieron cobrar porque no había tarifa (para avisarlo en pantalla).
export function unpricedSeconds(entries: TimeEntry[], rates: ClientRate[]): number {
  return entries.reduce((sum, e) => (rateFor(rates, e.clientId, entryDate(e)) === undefined ? sum + e.duration : sum), 0)
}

// Valida un periodo nuevo contra los existentes del mismo cliente. Devuelve el mensaje de error o null.
export function validateRatePeriod(
  existing: ClientRate[],
  candidate: { clientId: string; hourlyRate: number; validFrom: string; validTo: string }
): string | null {
  if (!candidate.validFrom) return 'Indica desde cuándo aplica la tarifa.'
  if (!(candidate.hourlyRate > 0)) return 'La tarifa debe ser mayor a 0.'
  if (candidate.validTo && candidate.validTo < candidate.validFrom) return 'La fecha final no puede ser anterior a la inicial.'
  const end = candidate.validTo || OPEN_END
  const clash = existing.find((r) => r.clientId === candidate.clientId && candidate.validFrom <= (r.validTo || OPEN_END) && r.validFrom <= end)
  if (clash) return `Se traslapa con una tarifa existente (${clash.validFrom} → ${clash.validTo || 'sin fin'}).`
  return null
}

export function formatMoney(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
}

export function formatCompactMoney(n: number): string {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`
}

export function formatHours(seconds: number): string {
  const h = Math.round((seconds / 3600) * 10) / 10
  return `${h} h`
}

export function formatClock(totalSeconds: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}
