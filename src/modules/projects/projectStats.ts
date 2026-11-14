import { Task, TimeEntry } from '../../models'

// Segundos acumulados por tarea (solo registros ya detenidos).
export function secondsByTask(entries: TimeEntry[]): Map<string, number> {
  const map = new Map<string, number>()
  entries
    .filter((e) => e.status === 'STOPPED')
    .forEach((e) => map.set(e.taskId, (map.get(e.taskId) ?? 0) + e.duration))
  return map
}

export interface ProjectSummary {
  totalTasks: number
  completedTasks: number
  progressPct: number // 0-100
  totalSeconds: number
  estimatedHours: number
}

export function summarizeProject(tasks: Task[], entries: TimeEntry[]): ProjectSummary {
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length
  const totalSeconds = entries
    .filter((e) => e.status === 'STOPPED')
    .reduce((s, e) => s + e.duration, 0)
  return {
    totalTasks: tasks.length,
    completedTasks,
    progressPct: tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0,
    totalSeconds,
    estimatedHours: tasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0),
  }
}
