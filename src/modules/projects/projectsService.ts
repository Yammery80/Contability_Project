import { createFirestoreService } from '../../services/firestoreService'
import { Project } from '../../models'

export const projectsService = createFirestoreService<Project>('projects')
