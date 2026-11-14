import { doc, setDoc, onSnapshot, collection } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { createFirestoreService } from '../../services/firestoreService'
import { ClientRate, UserCost } from '../../models'

// HU-48: tarifas por cliente y periodo.
export const clientRatesService = createFirestoreService<ClientRate>('clientRates')

// HU-49: costo por hora, un documento por colaborador (id = id del usuario).
export const userCostsService = {
  subscribe(callback: (items: UserCost[]) => void, onError?: (e: Error) => void): () => void {
    return onSnapshot(
      collection(db, 'userCosts'),
      (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as UserCost)),
      onError
    )
  },
  async set(userId: string, hourlyCost: number, updatedBy: string): Promise<void> {
    await setDoc(doc(db, 'userCosts', userId), { hourlyCost, updatedAt: Date.now(), updatedBy })
  },
}
