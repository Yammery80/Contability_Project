import { AppUser, Role, TimeEntry } from '../models'

// Nivel del empleado para el cálculo del cobro estimado (ver diseño
// "Registro de tiempos": Junior / Senior / Administrador).
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

// TARIFAS DE EJEMPLO (MXN por hora). Las fórmulas/tarifas reales de
// rentabilidad están pendientes de la empresa — reemplazar aquí.
export const HOURLY_RATE: Record<UserLevel, number> = {
  JUNIOR: 250,
  SENIOR: 400,
  ADMIN: 600,
}

export function entryLevel(entry: TimeEntry, users: AppUser[]): UserLevel {
  return levelForRole(users.find((u) => u.id === entry.userId)?.role)
}

export function estimatedCharge(entries: TimeEntry[], users: AppUser[]): number {
  return entries.reduce((sum, e) => sum + (e.duration / 3600) * HOURLY_RATE[entryLevel(e, users)], 0)
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
