import { createFirestoreService } from '../../services/firestoreService'
import { AppNotification } from '../../models'

export const notificationsService = createFirestoreService<AppNotification>('notifications')
