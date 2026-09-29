import { createFirestoreService } from '../../services/firestoreService'
import { TimeEntry } from '../../models'

export const timeEntriesService = createFirestoreService<TimeEntry>('timeEntries')

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${h}h ${m}m ${s}s`
}

export function formatHoursMinutes(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  return `${h} h ${m} min`
}

// Devuelve el timestamp (ms) del lunes 00:00 de la semana que contiene `date`.
export function startOfWeek(date = new Date()): number {
  const d = new Date(date)
  const day = d.getDay() // 0=domingo … 6=sábado
  const diff = (day === 0 ? -6 : 1) - day // retrocede hasta el lunes
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
