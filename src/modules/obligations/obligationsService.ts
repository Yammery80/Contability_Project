import { createFirestoreService } from '../../services/firestoreService'
import { Obligation } from '../../models'

export const obligationsService = createFirestoreService<Obligation>('obligations')

// Semáforo visual según cercanía de la fecha límite.
// NOTA: esta lógica es temporal con datos ficticios; las reglas fiscales
// reales (tipos de declaración, fechas automáticas, documentación requerida)
// se definirán en una iteración futura, según el brief.
export function obligationSemaphore(dueDate: string, status: string): 'green' | 'yellow' | 'red' {
  if (status === 'DONE') return 'green'
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'red'
  if (days <= 5) return 'yellow'
  return 'green'
}
