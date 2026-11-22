import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { createFirestoreService } from '../../services/firestoreService'
import type { AppNotification } from '../../models'

export const notificationsService = createFirestoreService<AppNotification>('notifications')

/** Identificador estable para no repetir una alerta del mismo evento. */
export async function createOnce(id: string, data: Omit<AppNotification, 'id'>) {
  await setDoc(doc(db, 'notifications', id), data)
}
