import { Activity, TimeSuggestion } from '../../models'

// Dos actividades pertenecen al mismo bloque si entre una y otra pasan 15 minutos o menos.
export const GAP_SECONDS = 15 * 60
// Los bloques de menos de 1 minuto en total no se sugieren solos (quedan disponibles para elegirlos a mano).
export const MIN_BLOCK_SECONDS = 60

// Agrupa actividades cercanas en el tiempo en bloques de trabajo (HU-61).
export function groupActivities(activities: Activity[], gapSeconds = GAP_SECONDS): Activity[][] {
  const sorted = [...activities].sort((a, b) => a.startTime - b.startTime)
  const groups: Activity[][] = []
  let lastEnd = 0
  for (const a of sorted) {
    const current = groups[groups.length - 1]
    if (current && a.startTime - lastEnd <= gapSeconds * 1000) {
      current.push(a)
      lastEnd = Math.max(lastEnd, a.endTime)
    } else {
      groups.push([a])
      lastEnd = a.endTime
    }
  }
  return groups
}

// Tiempo realmente trabajado: suma de lo capturado. Los huecos entre actividades y la inactividad no cuentan.
export const totalSeconds = (acts: Activity[]): number => acts.reduce((sum, a) => sum + a.duration, 0)

// Arma la sugerencia de un bloque. El cliente queda por asignar: la persona lo elige al revisarla.
export function buildSuggestion(
  acts: Activity[],
  userId: string,
  appNameOf: (domain: string) => string,
  now = Date.now()
): Omit<TimeSuggestion, 'id'> {
  const names = [...new Set(acts.map((a) => appNameOf(a.domain)))]
  return {
    userId,
    activityIds: acts.map((a) => a.id),
    startTime: Math.min(...acts.map((a) => a.startTime)),
    endTime: Math.max(...acts.map((a) => a.endTime)),
    duration: totalSeconds(acts),
    clientId: '',
    projectId: '',
    taskId: '',
    description: names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : ''),
    status: 'PENDING',
    createdAt: now,
  }
}
