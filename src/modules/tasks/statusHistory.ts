import { AppUser, StatusChange, Task, TaskStatus } from '../../models'

// HU-22: arma el "patch" que se guarda en Firestore al cambiar el estado de
// una tarea. Lo usan el Kanban y el detalle de tarea para no duplicar lógica.
// Incluye (1) el nuevo estado, (2) el manejo de completedAt/completedBy y
// el historial de finalizaciones (ya existente) y (3) el nuevo historial de
// cambios de estado con fecha y usuario.
export function buildStatusPatch(
  task: Task,
  status: TaskStatus,
  actor: Pick<AppUser, 'id' | 'name'>,
  now = Date.now()
): Partial<Task> {
  const change: StatusChange = {
    from: task.status,
    to: status,
    userId: actor.id,
    userName: actor.name,
    changedAt: now,
  }

  const patch: Partial<Task> = {
    status,
    statusHistory: [...(task.statusHistory ?? []), change],
  }

  if (status === 'COMPLETED') {
    patch.completedAt = now
    patch.completedBy = actor.id
    patch.completionHistory = [
      ...(task.completionHistory ?? []),
      { userId: actor.id, userName: actor.name, completedAt: now },
    ]
  } else if (task.status === 'COMPLETED') {
    // Se conserva el historial de finalizaciones anteriores.
    patch.completedAt = 0
    patch.completedBy = ''
  }

  return patch
}
