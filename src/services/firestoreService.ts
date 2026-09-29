import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  QueryConstraint,
} from 'firebase/firestore'
import { db } from '../firebase/config'

// Servicio genérico de CRUD reutilizable para cualquier colección de Firestore.
// Cada módulo (users, clients, projects, tasks, ...) lo instancia con su propio nombre de colección.
export function createFirestoreService<T extends { id: string }>(collectionName: string) {
  const colRef = collection(db, collectionName)

  return {
    async list(constraints: QueryConstraint[] = []): Promise<T[]> {
      const q = query(colRef, ...constraints)
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)
    },

    async getById(id: string): Promise<T | null> {
      const ref = doc(db, collectionName, id)
      const snap = await getDoc(ref)
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null
    },

    async create(data: Omit<T, 'id'>): Promise<string> {
      const ref = await addDoc(colRef, data as any)
      return ref.id
    },

    async update(id: string, data: Partial<T>): Promise<void> {
      const ref = doc(db, collectionName, id)
      await updateDoc(ref, data as any)
    },

    async remove(id: string): Promise<void> {
      const ref = doc(db, collectionName, id)
      await deleteDoc(ref)
    },

    // Suscripción en tiempo real, útil para dashboards y listas que deben
    // reflejar cambios sin recargar la página.
    subscribe(
      callback: (items: T[]) => void,
      constraints: QueryConstraint[] = []
    ): () => void {
      const q = query(colRef, ...constraints)
      return onSnapshot(q, (snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T))
      })
    },
  }
}

export { orderBy }
