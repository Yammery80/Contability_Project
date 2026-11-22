import { notificationsService } from '../modules/notifications/notificationsService'
import type { AppNotification, NotificationLevel } from '../models'

/** Los avisos son secundarios: no impiden guardar una tarea si fallan. */
export async function notifyUser(
  userId: string | undefined, title: string, message: string,
  level: NotificationLevel = 'INFO',
  context?: { kind: NonNullable<AppNotification['kind']>; sourceId: string; actorId: string },
) {
  if (!userId || !context) return
  try {
    await notificationsService.create({
      userId, title, message, level, read: false, createdAt: Date.now(),
      ...context,
    })
  } catch (err) {
    console.warn('No se pudo crear la notificación:', err)
  }
}
