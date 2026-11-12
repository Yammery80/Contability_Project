import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'

export interface SemaphoreSettings {
  redDays: number
  yellowDays: number
}

export const DEFAULT_SEMAPHORE: SemaphoreSettings = {
  redDays: 0,
  yellowDays: 5,
}

const settingsRef = doc(db, 'settings', 'semaphore')

function validSettings(data: unknown): data is SemaphoreSettings {
  if (!data || typeof data !== 'object') return false
  const value = data as Partial<SemaphoreSettings>
  return Number.isInteger(value.redDays) &&
    Number.isInteger(value.yellowDays) &&
    value.redDays! >= 0 &&
    value.yellowDays! > value.redDays! &&
    value.yellowDays! <= 365
}

export function useSemaphoreSettings() {
  const [settings, setSettings] = useState<SemaphoreSettings>(
    DEFAULT_SEMAPHORE
  )
  const [error, setError] = useState('')

  useEffect(() => {
    return onSnapshot(
      settingsRef,
      (snapshot) => {
        const data = snapshot.data()
        if (!snapshot.exists()) {
          setSettings(DEFAULT_SEMAPHORE)
          setError('')
        } else if (validSettings(data)) {
          setSettings({
            redDays: data.redDays,
            yellowDays: data.yellowDays,
          })
          setError('')
        } else {
          setError('La configuración del semáforo no es válida.')
        }
      },
      (err) => {
        console.error('Error al leer configuración:', err)
        setError('No se pudo leer la configuración del semáforo.')
      }
    )
  }, [])

  return { settings, error }
}

export async function saveSemaphoreSettings(
  value: SemaphoreSettings
): Promise<void> {
  if (!validSettings(value)) {
    throw new Error(
      'Los días rojos deben ser 0 o más; los amarillos deben ser mayores y no superar 365.'
    )
  }
  await setDoc(settingsRef, value)
}

export function semaphoreForDate(
  dueDate: string,
  completed: boolean,
  settings: SemaphoreSettings = DEFAULT_SEMAPHORE
): 'green' | 'yellow' | 'red' {
  if (completed || !dueDate) return 'green'

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate)
  if (!match) return 'green'

  const target = new Date(
    Number(match[1]), Number(match[2]) - 1, Number(match[3])
  )
  if (
    target.getFullYear() !== Number(match[1]) ||
    target.getMonth() !== Number(match[2]) - 1 ||
    target.getDate() !== Number(match[3])
  ) return 'green'

  const today = new Date()
  const utcToday = Date.UTC(
    today.getFullYear(), today.getMonth(), today.getDate()
  )
  const utcTarget = Date.UTC(
    target.getFullYear(), target.getMonth(), target.getDate()
  )
  const days = Math.round((utcTarget - utcToday) / 86400000)

  if (days <= settings.redDays) return 'red'
  if (days <= settings.yellowDays) return 'yellow'
  return 'green'
}
