import { createFirestoreService } from '../../services/firestoreService'
import { Client } from '../../models'

export const clientsService = createFirestoreService<Client>('clients')
