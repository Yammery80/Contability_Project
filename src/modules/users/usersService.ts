import { createFirestoreService } from '../../services/firestoreService'
import { AppUser } from '../../models'

export const usersService = createFirestoreService<AppUser>('users')
