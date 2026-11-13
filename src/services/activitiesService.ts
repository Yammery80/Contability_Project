import { getFirestore, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { AppUser } from '../models'

export interface ActivityItem {
  id: string
  userId: string
  userName: string
  action: string
  taskTitle: string
  createdAt: number
}

export const activitiesService = {
  subscribeToTeamActivities: (callback: (activities: ActivityItem[]) => void) => {
    const db = getFirestore()
    const q = query(
      collection(db, 'activities'),
      orderBy('createdAt', 'desc')
    )

    return onSnapshot(q, (snapshot) => {
      const items: ActivityItem[] = []
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as ActivityItem)
      })
      callback(items)
    })
  }
}