import { createFirestoreService } from '../../services/firestoreService'
import { TrackedApp } from '../../models'

// Colección "trackedApps": la administra el Administrador/Superusuario y la
// descarga la extensión de Chrome de cada colaborador para saber dónde registrar.
export const trackedAppsService = createFirestoreService<TrackedApp>('trackedApps')
