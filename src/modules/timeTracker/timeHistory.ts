import type { TimeEntry } from '../../models'
import { entryDate } from '../../services/period'

export const originLabel: Record<TimeEntry['type'], string> = {
  TIMER: 'Cronómetro', MANUAL: 'Manual', LEA_MEMORY: 'Lea Memory (automático)',
}

// Las fechas del formulario representan días de calendario en la zona local.
export function localDay(timestamp: number) {
  const d = new Date(timestamp)
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

export function historyRows(entries: TimeEntry[], from: string, to: string, employee: string) {
  if (!from || !to || from > to) return []
  const start = new Date(from + 'T00:00:00').getTime()
  const end = new Date(to + 'T00:00:00')
  end.setDate(end.getDate() + 1)
  return entries.filter(e => e.status === 'STOPPED' && (!employee || e.userId === employee)
    && entryDate(e) >= start && entryDate(e) < end.getTime())
    .sort((a, b) => entryDate(b) - entryDate(a))
}

interface Group {
  seconds: number
  children: Map<string, Group>
}
type GroupField = 'userId' | 'clientId' | 'projectId' | 'taskId' | 'description'
export function groupHours(rows: TimeEntry[], fields: GroupField[] = ['userId', 'clientId', 'projectId', 'taskId']) {
  const groups = new Map<string, Group>()
  for (const row of rows) {
    let level = groups
    for (const field of fields) {
      const key = row[field] || ''
      let group = level.get(key)
      if (!group) {
        group = { seconds: 0, children: new Map() }
        level.set(key, group)
      }
      group.seconds += row.duration
      level = group.children
    }
  }
  return groups
}
