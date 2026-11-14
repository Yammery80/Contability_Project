import { AppUser, Task, TimeEntry } from '../../models'
import { entryDate, inRange } from '../../services/period'

export const WEEKLY_TARGET_HOURS = 40

export interface MemberStats {
  user: AppUser
  weekSeconds: number
  monthSeconds: number
  activeTasks: number
  overdueTasks: number
  completedInPeriod: number
  runningNow: boolean
}

// HU-43: arma una fila por colaborador con sus horas y el avance de sus tareas.
// weekStart: lunes 00:00 (ms) de la semana actual.
// monthRange: [inicio, fin) del periodo elegido en el dashboard.
export function buildTeamStats(
  members: AppUser[],
  tasks: Task[],
  entries: TimeEntry[],
  weekStart: number,
  monthRange: [number, number],
  isTaskOverdue: (t: Task) => boolean
): MemberStats[] {
  const weekRange: [number, number] = [weekStart, weekStart + 7 * 86400000]

  return members.map((user) => {
    const mine = entries.filter((e) => e.userId === user.id)
    const stopped = mine.filter((e) => e.status === 'STOPPED')
    const sum = (list: TimeEntry[]) => list.reduce((s, e) => s + e.duration, 0)

    const myTasks = tasks.filter((t) => t.assignedUserId === user.id)

    return {
      user,
      weekSeconds: sum(stopped.filter((e) => inRange(entryDate(e), weekRange))),
      monthSeconds: sum(stopped.filter((e) => inRange(entryDate(e), monthRange))),
      activeTasks: myTasks.filter((t) => t.status !== 'COMPLETED').length,
      overdueTasks: myTasks.filter(isTaskOverdue).length,
      completedInPeriod: myTasks.filter((t) => t.status === 'COMPLETED' && !!t.completedAt && inRange(t.completedAt, monthRange)).length,
      runningNow: mine.some((e) => e.status === 'RUNNING'),
    }
  })
}
