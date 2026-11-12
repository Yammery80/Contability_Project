import { Project, Task, TimeSuggestion } from '../../models'

export const MIN_DURATION_SECONDS = 60
export const MAX_DURATION_SECONDS = 24 * 3600

export interface EditValues {
  clientId: string
  projectId: string
  taskId: string
  description: string
  date: string // AAAA-MM-DD
  hours: number
  minutes: number
}

// Cliente, proyecto y tarea deben corresponder entre sí (HU-62).
export function validateAssignment(
  v: Pick<EditValues, 'clientId' | 'projectId' | 'taskId'>,
  projects: Pick<Project, 'id' | 'clientId'>[],
  tasks: Pick<Task, 'id' | 'projectId'>[]
): string | null {
  if (v.projectId) {
    const project = projects.find((p) => p.id === v.projectId)
    if (!project) return 'El proyecto elegido ya no existe.'
    if (!v.clientId) return 'Elige el cliente del proyecto.'
    if (project.clientId !== v.clientId) return 'El proyecto no pertenece al cliente elegido.'
  }
  if (v.taskId) {
    const task = tasks.find((t) => t.id === v.taskId)
    if (!task) return 'La tarea elegida ya no existe.'
    if (!v.projectId) return 'Elige el proyecto de la tarea.'
    if (task.projectId !== v.projectId) return 'La tarea no pertenece al proyecto elegido.'
  }
  return null
}

export function validateEdit(v: EditValues, today: string): string | null {
  const seconds = v.hours * 3600 + v.minutes * 60
  if (!Number.isInteger(v.hours) || !Number.isInteger(v.minutes) || v.hours < 0 || v.minutes < 0 || v.minutes > 59) return 'La duración no es válida.'
  if (seconds < MIN_DURATION_SECONDS) return 'La duración debe ser de al menos 1 minuto.'
  if (seconds > MAX_DURATION_SECONDS) return 'La duración no puede pasar de 24 horas.'
  if (!v.date) return 'Elige la fecha.'
  if (v.date > today) return 'La fecha no puede ser futura.'
  return null
}

// Cambios que se guardan al editar:
//  - la fecha mueve el bloque entero conservando su hora del día;
//  - la duración manda; si es más larga que el rango original se alarga la hora de fin, para que el
//    registro siga siendo coherente (la duración nunca supera el rango entre inicio y fin);
//  - si no se tocó la duración, se conserva exacta (sin redondear los segundos).
// Las actividades de origen (activityIds) no se tocan nunca.
export function applyEdit(s: Pick<TimeSuggestion, 'startTime' | 'endTime' | 'duration'>, v: EditValues): Partial<TimeSuggestion> {
  const [y, m, d] = v.date.split('-').map(Number)
  const orig = new Date(s.startTime)
  const startTime = new Date(y, m - 1, d, orig.getHours(), orig.getMinutes(), orig.getSeconds()).getTime()
  const span = s.endTime - s.startTime
  const typed = v.hours * 3600 + v.minutes * 60
  const duration = typed === Math.round(s.duration / 60) * 60 ? s.duration : typed
  return {
    clientId: v.clientId,
    projectId: v.projectId,
    taskId: v.taskId,
    description: v.description.trim(),
    startTime,
    endTime: startTime + Math.max(span, duration * 1000),
    duration,
  }
}
