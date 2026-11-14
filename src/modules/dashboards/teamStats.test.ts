import { describe, expect, it } from 'vitest'
import { buildTeamStats } from './teamStats'
import { AppUser, Task, TimeEntry } from '../../models'

const DAY = 86400000
const user = (id: string): AppUser => ({ id, name: id, email: '', role: 'OPERATOR', active: true, createdAt: 0 })
const entry = (userId: string, endTime: number, duration: number, status: TimeEntry['status'] = 'STOPPED'): TimeEntry => ({
  id: Math.random().toString(), userId, clientId: 'c', projectId: 'p', taskId: 't',
  startTime: endTime - duration * 1000, endTime, duration, description: '', type: 'MANUAL', status,
})
const task = (assignedUserId: string, status: Task['status'], completedAt = 0): Task => ({
  id: Math.random().toString(), projectId: 'p', title: '', description: '', assignedUserId,
  status, priority: 'LOW', dueDate: '', createdAt: 0, completedAt,
})

describe('buildTeamStats (HU-43)', () => {
  const weekStart = 10 * DAY
  const month: [number, number] = [0, 30 * DAY]

  it('separa horas de la semana y del periodo por colaborador', () => {
    const [a, b] = buildTeamStats(
      [user('a'), user('b')], [],
      [entry('a', weekStart + DAY, 3600), entry('a', 2 * DAY, 7200), entry('b', weekStart + 2 * DAY, 1800)],
      weekStart, month, () => false
    )
    expect(a.weekSeconds).toBe(3600)
    expect(a.monthSeconds).toBe(10800)
    expect(b.weekSeconds).toBe(1800)
  })

  it('cuenta tareas activas, vencidas y completadas en el periodo', () => {
    const tasks = [task('a', 'PENDING'), task('a', 'IN_PROGRESS'), task('a', 'COMPLETED', 5 * DAY), task('a', 'COMPLETED', 99 * DAY)]
    const [a] = buildTeamStats([user('a')], tasks, [], weekStart, month, (t) => t.status === 'PENDING')
    expect(a.activeTasks).toBe(2)
    expect(a.overdueTasks).toBe(1)
    expect(a.completedInPeriod).toBe(1)
  })

  it('detecta cronómetro en curso y no suma sus horas', () => {
    const [a] = buildTeamStats([user('a')], [], [entry('a', weekStart + DAY, 9999, 'RUNNING')], weekStart, month, () => false)
    expect(a.runningNow).toBe(true)
    expect(a.weekSeconds).toBe(0)
  })
})
