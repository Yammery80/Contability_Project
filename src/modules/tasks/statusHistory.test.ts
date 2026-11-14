import { describe, expect, it } from 'vitest'
import { buildStatusPatch } from './statusHistory'
import { Task } from '../../models'

const actor = { id: 'u1', name: 'Andrea Cruz' }
const base: Task = {
  id: 't1', projectId: 'p1', title: 'Tarea', description: '', assignedUserId: 'u1',
  status: 'PENDING', priority: 'MEDIUM', dueDate: '2026-12-01', createdAt: 0,
}

describe('buildStatusPatch (HU-22)', () => {
  it('registra de qué estado a cuál, quién y cuándo', () => {
    const patch = buildStatusPatch(base, 'IN_PROGRESS', actor, 1000)
    expect(patch.status).toBe('IN_PROGRESS')
    expect(patch.statusHistory).toEqual([
      { from: 'PENDING', to: 'IN_PROGRESS', userId: 'u1', userName: 'Andrea Cruz', changedAt: 1000 },
    ])
    expect(patch.completedAt).toBeUndefined()
  })

  it('conserva los cambios anteriores y agrega uno nuevo', () => {
    const task: Task = {
      ...base, status: 'IN_PROGRESS',
      statusHistory: [{ from: 'PENDING', to: 'IN_PROGRESS', userId: 'u2', userName: 'Otro', changedAt: 500 }],
    }
    const patch = buildStatusPatch(task, 'COMPLETED', actor, 2000)
    expect(patch.statusHistory).toHaveLength(2)
    expect(patch.statusHistory![0].userId).toBe('u2')
    expect(patch.statusHistory![1]).toMatchObject({ from: 'IN_PROGRESS', to: 'COMPLETED', changedAt: 2000 })
  })

  it('al completar guarda completedAt/By y agrega a completionHistory', () => {
    const patch = buildStatusPatch({ ...base, status: 'IN_PROGRESS' }, 'COMPLETED', actor, 3000)
    expect(patch.completedAt).toBe(3000)
    expect(patch.completedBy).toBe('u1')
    expect(patch.completionHistory).toEqual([{ userId: 'u1', userName: 'Andrea Cruz', completedAt: 3000 }])
  })

  it('al reabrir limpia completedAt/By pero conserva completionHistory', () => {
    const task: Task = {
      ...base, status: 'COMPLETED', completedAt: 3000, completedBy: 'u1',
      completionHistory: [{ userId: 'u1', userName: 'Andrea Cruz', completedAt: 3000 }],
    }
    const patch = buildStatusPatch(task, 'IN_PROGRESS', actor, 4000)
    expect(patch.completedAt).toBe(0)
    expect(patch.completedBy).toBe('')
    expect(patch.completionHistory).toBeUndefined()
  })
})
