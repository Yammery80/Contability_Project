import type { AppUser, Client, Obligation, Project, ReportDetail, Task, TimeEntry } from '../../models'
import { formatClock, toDateStr } from '../../services/billing'
import type { ReportSection } from '../../services/exportReport'

export type RecordKind = 'timeEntries' | 'obligations'
export const obligationStatus = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', DONE: 'Cumplida', OVERDUE: 'Vencida',
}

export function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map(item => [item.id, item]))
}

interface Directory {
  clients: Map<string, Client>
  users: Map<string, AppUser>
  projects: Map<string, Project>
  tasks: Map<string, Task>
}

export interface ActivityRecord {
  id: string
  kind: RecordKind
  saved?: ReportDetail
  sourceClientId: string
  sourceDate: string
  detail: ReportDetail
  businessActivity: string
  context: string[]
}

const clean = (text: unknown) => typeof text === 'string' ? text.trim() : ''
const dateTime = new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' })
const validTimestamp = (value: number | null | undefined): value is number =>
  typeof value === 'number' && value > 0 && Number.isFinite(new Date(value).getTime())
const recordedTime = (value: number | null | undefined) => validTimestamp(value) ? dateTime.format(value) : ''

export function validDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && toDateStr(new Date(value + 'T12:00:00').getTime()) === value
}

function record(kind: RecordKind, source: TimeEntry | Obligation, clientId: string, userId: string,
  activity: string, date: string, context: string[], directory: Directory): ActivityRecord {
  const saved = source.reportDetail
  const effectiveClient = clientId || clean(saved?.clientId)
  const client = directory.clients.get(effectiveClient)
  const sameClient = saved?.clientId === effectiveClient
  return {
    id: source.id, kind, saved, sourceClientId: clientId, sourceDate: date, context,
    businessActivity: clean(client?.businessActivity),
    detail: {
      clientId: effectiveClient,
      clientName: clean(client?.name) || (sameClient ? clean(saved?.clientName) : ''),
      userId,
      responsibleName: clean(directory.users.get(userId)?.name) || (saved?.userId === userId ? clean(saved.responsibleName) : ''),
      activity: (sameClient ? clean(saved?.activity) : '') || clean(activity),
      purpose: sameClient ? clean(saved?.purpose) : '',
      date: date || (sameClient && saved?.date && validDay(saved.date) ? saved.date : ''),
    },
  }
}

export function timeActivity(entry: TimeEntry, directory: Directory): ActivityRecord {
  const task = directory.tasks.get(entry.taskId)
  const project = directory.projects.get(entry.projectId || task?.projectId || '')
  const timestamp = validTimestamp(entry.endTime) ? entry.endTime : entry.startTime
  return record('timeEntries', entry, entry.clientId || project?.clientId || '', entry.userId,
    clean(entry.description) || clean(task?.title), validTimestamp(timestamp) ? toDateStr(timestamp) : '',
    [project?.name || '', task?.title || '', recordedTime(entry.startTime), recordedTime(entry.endTime), formatClock(entry.duration)], directory)
}

export function obligationActivity(obligation: Obligation, directory: Directory): ActivityRecord {
  const completed = obligation.status === 'DONE'
  const completedBy = clean(obligation.completedByName) || clean(directory.users.get(obligation.completedBy || '')?.name)
  return record('obligations', obligation, obligation.clientId, obligation.assignedUserId, obligation.name,
    validDay(obligation.dueDate) ? obligation.dueDate : '',
    [obligationStatus[obligation.status], completed ? recordedTime(obligation.completedAt) : '', completed ? completedBy : ''], directory)
}

export function missingFields(detail: ReportDetail): string[] {
  const missing: string[] = []
  if (!clean(detail.responsibleName)) missing.push('nombre del responsable')
  if (!clean(detail.clientId) || !clean(detail.clientName)) missing.push('cliente')
  if (!clean(detail.activity)) missing.push('actividad')
  if (!validDay(detail.date)) missing.push('fecha')
  if (!clean(detail.purpose)) missing.push('motivo')
  return missing
}

// Las proyecciones para agrupar y calcular importes nunca modifican el tiempo original.
export function reportedTime(entry: TimeEntry, row: ActivityRecord): TimeEntry {
  const endTime = !row.sourceDate && row.detail.date ? new Date(row.detail.date + 'T12:00:00').getTime() : entry.endTime
  return { ...entry, clientId: row.detail.clientId, description: row.detail.activity, endTime }
}

export function selectActivities<T extends { record: ActivityRecord }>(
  items: T[], clientId: string, userId: string, range: [number, number],
) {
  const [start, end] = range.map(toDateStr)
  const matching = items.filter(({ record: { detail } }) =>
    (!clientId || detail.clientId === clientId) && (!userId || detail.userId === userId))
  const dated = matching.filter(({ record }) => record.detail.date >= start && record.detail.date < end)
    .sort((a, b) => a.record.detail.date.localeCompare(b.record.detail.date) || a.record.id.localeCompare(b.record.id))
  return { dated, undated: matching.filter(({ record }) => !record.detail.date).map(item => item.record) }
}

export function detailHeaders(kind: RecordKind): string[] {
  const common = ['Nombre del responsable', 'Cliente', 'Giro del cliente', 'Actividad', 'Motivo del trabajo']
  return kind === 'timeEntries'
    ? [...common, 'Fecha de trabajo', 'Proyecto', 'Tarea', 'Inicio registrado', 'Fin registrado', 'Tiempo trabajado']
    : [...common, 'Fecha límite', 'Estado', 'Fecha de cumplimiento', 'Cumplida por']
}

export function detailValues(row: ActivityRecord): string[] {
  const { responsibleName, clientName, activity, purpose, date } = row.detail
  return [responsibleName, clientName, row.businessActivity || 'Sin registrar', activity, purpose, date, ...row.context]
}

export function activitySection(kind: RecordKind, records: ActivityRecord[]): ReportSection {
  return { title: 'Detalle de actividades por cliente', headers: detailHeaders(kind), rows: records.map(detailValues) }
}
