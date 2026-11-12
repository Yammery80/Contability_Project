import { doc, runTransaction } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { createFirestoreService } from '../../services/firestoreService'
import { Obligation } from '../../models'
import {
  semaphoreForDate,
  type SemaphoreSettings,
} from '../calendar/semaphoreSettings'

export const obligationsService = createFirestoreService<Obligation>('obligations')

export async function reassignObligation(id: string, toUserId: string, changedBy: string, changedByName: string): Promise<void> {
  const ref = doc(db, 'obligations', id)
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref)
    if (!snap.exists()) throw new Error('La obligación ya no existe')
    const current = snap.data() as Obligation
    if (current.status === 'DONE') throw new Error('No se puede reasignar una obligación cumplida')
    if (current.assignedUserId === toUserId) return
    const entry = { fromUserId: current.assignedUserId || '', toUserId, changedBy, changedByName, changedAt: Date.now() }
    transaction.update(ref, { assignedUserId: toUserId, assignmentHistory: [...(current.assignmentHistory || []), entry] })
  })
}

export async function completeObligation(id: string, userId: string, userName: string): Promise<void> {
  const ref = doc(db, 'obligations', id)
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref)
    if (!snap.exists()) throw new Error('La obligación ya no existe')
    const current = snap.data() as Obligation
    if (current.status === 'DONE') return
    const completedAt = Date.now()
    transaction.update(ref, {
      status: 'DONE', completedAt, completedBy: userId, completedByName: userName,
      completionHistory: [...(current.completionHistory || []), { userId, userName, completedAt }],
    })
  })
}

export function obligationSemaphore(
  dueDate: string,
  status: string,
  settings?: SemaphoreSettings
): 'green' | 'yellow' | 'red' {
  return semaphoreForDate(dueDate, status === 'DONE', settings)
}
