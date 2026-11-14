import { describe, expect, it } from 'vitest'
import { secondsByTask, summarizeProject } from './projectStats'
import { Task, TimeEntry } from '../../models'

const entry = (taskId: string, duration: number, status: TimeEntry['status'] = 'STOPPED'): TimeEntry => ({
  id: Math.random().toString(), userId: 'u', clientId: 'c', projectId: 'p', taskId,
  startTime: 1, endTime: 2, duration, description: '', type: 'MANUAL', status,
})
const task = (id: string, status: Task['status'], estimatedHours?: number): Task => ({
  id, projectId: 'p', title: id, description: '', assignedUserId: 'u', status,
  priority: 'LOW', dueDate: '', createdAt: 0, estimatedHours,
})

describe('projectStats (HU-18)', () => {
  it('suma horas por tarea e ignora cronómetros sin detener', () => {
    const m = secondsByTask([entry('a', 3600), entry('a', 1800), entry('b', 600), entry('b', 9999, 'RUNNING')])
    expect(m.get('a')).toBe(5400)
    expect(m.get('b')).toBe(600)
  })

  it('calcula avance, horas y estimado del proyecto', () => {
    const s = summarizeProject(
      [task('a', 'COMPLETED', 4), task('b', 'IN_PROGRESS', 6), task('c', 'PENDING'), task('d', 'COMPLETED', 2)],
      [entry('a', 7200), entry('b', 3600)]
    )
    expect(s).toEqual({ totalTasks: 4, completedTasks: 2, progressPct: 50, totalSeconds: 10800, estimatedHours: 12 })
  })

  it('un proyecto sin tareas tiene 0% de avance', () => {
    expect(summarizeProject([], []).progressPct).toBe(0)
  })
})
