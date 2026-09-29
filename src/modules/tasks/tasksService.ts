import { createFirestoreService } from '../../services/firestoreService'
import { Task } from '../../models'

export const tasksService = createFirestoreService<Task>('tasks')
