import { doc, type DocumentReference } from 'firebase/firestore'
import { db } from '../../firebase/config'

export function addTimeNotice(write: { set(ref: DocumentReference, data: Record<string, unknown>): unknown }, requestId: string, userId: string,
  event: 'pending' | 'decision', title: string, message: string) {
  const ref = doc(db, 'notifications', [requestId, event, userId].join('_'))
  write.set(ref, { userId, title, message: message.slice(0, 500), level: 'INFO', read: false, createdAt: Date.now() })
}
