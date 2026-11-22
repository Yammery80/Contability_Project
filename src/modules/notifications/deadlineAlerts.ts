import { where } from 'firebase/firestore'
import type { AppNotification, Obligation, Task } from '../../models'
import { createOnce, notificationsService } from './notificationsService'
import { tasksService } from '../tasks/tasksService'
import { obligationsService } from '../obligations/obligationsService'

function daysUntil(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const due = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(due) || new Date(due).toISOString().slice(0, 10) !== date) return null
  return Math.round((due - today) / 86400000)
}

function category(days: number) {
  return days < 0 ? 'overdue' : days <= 3 ? 'urgent' : days <= 7 ? 'warning' : null
}

function describe(thing: 'tarea' | 'obligación', name: string, days: number) {
  if (days < 0) return `La ${thing} "${name}" tiene ${-days} día(s) de retraso.`
  if (days === 0) return `La ${thing} "${name}" vence hoy.`
  return `La ${thing} "${name}" vence en ${days} día(s).`
}

/** Solo funciona con la aplicación abierta. No se cobran Functions ni mensajes externos. */
export async function checkMyDeadlines(userId: string): Promise<void> {
  // Se consulta únicamente el trabajo asignado a la sesión actual.
  const [tasks, obligations, existingNotifications] = await Promise.all([
    tasksService.list([where('assignedUserId', '==', userId)]),
    obligationsService.list([where('assignedUserId', '==', userId)]),
    notificationsService.list([where('userId', '==', userId)]),
  ])
  const existingIds = new Set(existingNotifications.map((n) => n.id))
  const entries: Array<{ id: string; title: string; dueDate: string; done: boolean; kind: NonNullable<AppNotification['kind']>; noun: 'tarea' | 'obligación' }> = [
    ...tasks.map((t: Task) => ({ id: t.id, title: t.title, dueDate: t.dueDate, done: t.status === 'COMPLETED', kind: 'TASK_DEADLINE' as const, noun: 'tarea' as const })),
    ...obligations.map((o: Obligation) => ({ id: o.id, title: o.name, dueDate: o.dueDate, done: o.status === 'DONE', kind: 'OBLIGATION_DEADLINE' as const, noun: 'obligación' as const })),
  ]
  await Promise.all(entries.map(async (entry) => {
    if (entry.done) return
    const days = daysUntil(entry.dueDate)
    if (days === null) return
    const severity = category(days)
    if (!severity) return
    const id = `deadline_${entry.kind}_${userId}_${entry.id}_${entry.dueDate}_${severity}`
    if (existingIds.has(id)) return
    const data: Omit<AppNotification, 'id'> = {
      userId, title: days < 0 ? 'Vencimiento atrasado' : days <= 3 ? 'Vencimiento urgente' : 'Próximo vencimiento',
      message: describe(entry.noun, entry.title, days),
      level: days <= 3 ? 'URGENT' : 'WARNING', read: false,
      createdAt: Date.now(), kind: entry.kind, sourceId: entry.id, actorId: userId,
    }
    try {
      // No sobrescribe las leídas; se revisa la lista autorizada del usuario.
      // Un intento concurrente de crear el mismo ID será rechazado por las reglas.
      await createOnce(id, data)
      existingIds.add(id)
    } catch (error) {
      console.warn('No se pudo registrar una alerta de vencimiento:', error)
    }
  }))
}
