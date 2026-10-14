import { notificationsService } from '../modules/notifications/notificationsService'
import { NotificationLevel } from '../models'

// Crea una notificación para un usuario. Nunca rompe el flujo principal:
// si las reglas de Firestore no permiten crearla (p. ej. un Operador),
// solo se registra una advertencia en consola.
export async function notifyUser(userId: string | undefined, title: string, message: string, level: NotificationLevel = 'INFO') {
  if (!userId) return
  try {
    await notificationsService.create({ userId, title, message, level, read: false, createdAt: Date.now() })
  } catch (err) {
    console.warn('No se pudo crear la notificación:', err)
  }
}
