import { TimeEntry } from '../models'

export const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// value = "YYYY-M" (M de 0 a 11)
export function monthOptions(count = 12): { value: string; label: string }[] {
  const now = new Date()
  const out: { value: string; label: string }[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({ value: `${d.getFullYear()}-${d.getMonth()}`, label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` })
  }
  return out
}

export function currentMonthValue(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth()}`
}

// Rango [inicio, fin) en ms del mes indicado; offset=-1 devuelve el mes anterior.
export function monthRange(value: string, offset = 0): [number, number] {
  const [y, m] = value.split('-').map(Number)
  return [new Date(y, m + offset, 1).getTime(), new Date(y, m + offset + 1, 1).getTime()]
}

export function monthLabel(value: string): string {
  const [y, m] = value.split('-').map(Number)
  return `${MONTH_NAMES[m]} ${y}`
}

// Fecha de un registro: el cronómetro detenido guarda endTime; el manual guarda ambos.
export function entryDate(e: TimeEntry): number {
  return e.endTime ?? e.startTime ?? 0
}

export function inRange(ts: number, [start, end]: [number, number]): boolean {
  return ts >= start && ts < end
}

export function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'justo ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ayer'
  if (d < 7) return `hace ${d} días`
  return new Date(ms).toLocaleDateString('es-MX')
}

export function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '')
}

export function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?'
}
