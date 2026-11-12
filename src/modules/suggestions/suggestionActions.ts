import { collection, doc, runTransaction } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { TimeEntry, TimeSuggestion } from '../../models'
import { timeSuggestionsService } from './timeSuggestionsService'

// Aprobar convierte la sugerencia en un registro de tiempo oficial (HU-65).
// Va en una transacción: el registro y el cambio de estado se guardan juntos o no se guarda nada,
// y si la sugerencia ya fue procesada (por ejemplo desde otra pestaña) no se duplica el tiempo.
// Devuelve el ID del registro de tiempo creado.
export async function approveSuggestion(id: string): Promise<string> {
  return runTransaction(db, async (tx) => {
    const suggestionRef = doc(db, 'timeSuggestions', id)
    const snap = await tx.get(suggestionRef)
    if (!snap.exists()) throw new Error('La sugerencia ya no existe.')
    const s = snap.data() as TimeSuggestion
    if (s.status !== 'PENDING') throw new Error('Esta sugerencia ya fue procesada.')
    if (!(s.duration > 0)) throw new Error('La sugerencia no tiene duración.')

    const entryRef = doc(collection(db, 'timeEntries'))
    const entry: Omit<TimeEntry, 'id'> = {
      userId: s.userId,
      clientId: s.clientId,
      projectId: s.projectId,
      taskId: s.taskId,
      startTime: s.startTime,
      endTime: s.endTime,
      duration: s.duration,
      description: s.description,
      type: 'LEA_MEMORY',
      status: 'STOPPED',
    }
    tx.set(entryRef, entry)
    tx.update(suggestionRef, { status: 'APPROVED', timeEntryId: entryRef.id, approvedAt: Date.now() })
    return entryRef.id
  })
}

// Rechazar descarta la sugerencia y guarda el motivo. Sus actividades no se vuelven a sugerir solas.
export async function rejectSuggestion(id: string, reason: string): Promise<void> {
  const text = reason.trim()
  if (text.length < 3) throw new Error('Escribe el motivo del rechazo.')
  await timeSuggestionsService.update(id, { status: 'DISCARDED', rejectReason: text, rejectedAt: Date.now() })
}
