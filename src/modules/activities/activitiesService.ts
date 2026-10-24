import { createFirestoreService } from '../../services/firestoreService'
import { Activity } from '../../models'

// Colección "activities": la llena la extensión de Chrome (y más adelante la
// app de escritorio y las integraciones). Cada usuario solo lee las suyas;
// consúltalas siempre con where('userId', '==', uid).
export const activitiesService = createFirestoreService<Activity>('activities')
