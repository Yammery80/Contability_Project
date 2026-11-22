import { doc, runTransaction } from 'firebase/firestore'
import { db } from '../../firebase/config'
import type { ReportDetail } from '../../models'
import { type ActivityRecord, missingFields } from './activityDetail'

export interface BusinessActivityChange {
  before: string
  after: string
}

export async function saveReportDetail(row: ActivityRecord, detail: ReportDetail, business?: BusinessActivityChange) {
  if (missingFields(detail).length) throw new Error('Completa todos los campos obligatorios.')
  const source = doc(db, row.kind, row.id)
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(source)
    if (!snapshot.exists()) throw new Error('El registro ya no está disponible.')
    const current = snapshot.data()
    const previous = current.reportDetail as ReportDetail | undefined
    const changed = (Object.keys(detail) as (keyof ReportDetail)[]).some(key => previous?.[key] !== row.saved?.[key])
    const userId = row.kind === 'timeEntries' ? current.userId : current.assignedUserId
    if (changed || userId !== detail.userId || (current.clientId && current.clientId !== detail.clientId)) {
      throw new Error('El registro cambió. Cierra el formulario y vuelve a abrirlo para ver los datos actuales.')
    }
    if (business && business.after !== business.before) {
      const client = doc(db, 'clients', detail.clientId)
      const latest = await transaction.get(client)
      if (!latest.exists() || (latest.data().businessActivity || '').trim() !== business.before) {
        throw new Error('El giro del cliente cambió. Cierra el formulario y revisa la ficha actualizada.')
      }
      transaction.update(client, { businessActivity: business.after, updatedAt: Date.now() })
    }
    transaction.update(source, { reportDetail: detail })
  })
}
