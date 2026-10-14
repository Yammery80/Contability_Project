import { useCallback, useEffect, useMemo, useState } from 'react'
import { where } from 'firebase/firestore'
import { timeEntriesService, startOfWeek } from './timeTrackerService'
import { useAuth } from '../../hooks/useAuth'
import { TimeEntry } from '../../models'

export interface ActivityRef {
  clientId: string
  projectId: string
  taskId: string
  description: string
}

// Cronómetro del usuario en sesión. El tiempo se calcula a partir de
// startTime guardado en Firestore, así sobrevive a cerrar el navegador.
export function useTimer() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!profile) return
    return timeEntriesService.subscribe(setEntries, [where('userId', '==', profile.id)])
  }, [profile])

  // Cronómetro en curso O pausado (HU-24: solo uno a la vez).
  const active = useMemo(() => entries.find((e) => e.status === 'RUNNING' || e.status === 'PAUSED') ?? null, [entries])
  const running = active?.status === 'RUNNING'

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running])

  const elapsedOf = useCallback(
    (e: TimeEntry) => e.duration + (e.status === 'RUNNING' && e.startTime ? Math.max(0, Math.floor((Date.now() - e.startTime) / 1000)) : 0),
    []
  )

  const elapsed = useMemo(() => {
    if (!active) return 0
    return active.duration + (running && active.startTime ? Math.max(0, Math.floor((now - active.startTime) / 1000)) : 0)
  }, [active, running, now])

  const weekSeconds = useMemo(() => {
    const weekStart = startOfWeek()
    const done = entries
      .filter((e) => e.status === 'STOPPED' && (e.endTime ?? 0) >= weekStart)
      .reduce((sum, e) => sum + e.duration, 0)
    return done + elapsed
  }, [entries, elapsed])

  // Devuelve un mensaje de error si no se pudo iniciar.
  const start = async (ref: ActivityRef): Promise<string | null> => {
    if (!profile) return 'Sin sesión.'
    if (active) return 'Ya tienes un cronómetro en curso. Detenlo antes de iniciar otro.'
    await timeEntriesService.create({
      userId: profile.id,
      ...ref,
      startTime: Date.now(),
      endTime: null,
      duration: 0,
      type: 'TIMER',
      status: 'RUNNING',
    })
    return null
  }

  const pause = async () => {
    if (!active || !running) return
    await timeEntriesService.update(active.id, { duration: elapsedOf(active), startTime: null, status: 'PAUSED' })
  }

  const resume = async () => {
    if (!active || running) return
    await timeEntriesService.update(active.id, { startTime: Date.now(), status: 'RUNNING' })
  }

  const stop = async () => {
    if (!active) return
    await timeEntriesService.update(active.id, { duration: elapsedOf(active), startTime: null, endTime: Date.now(), status: 'STOPPED' })
  }

  // Registro manual (HU-28). date: YYYY-MM-DD, from/to: HH:MM
  const addManual = async (ref: ActivityRef, date: string, from: string, to: string): Promise<string | null> => {
    if (!profile) return 'Sin sesión.'
    if (!date || !from || !to) return 'Completa fecha y horas.'
    const s = new Date(`${date}T${from}`).getTime()
    const e = new Date(`${date}T${to}`).getTime()
    if (!(e > s)) return 'La hora final debe ser posterior a la inicial.'
    await timeEntriesService.create({
      userId: profile.id,
      ...ref,
      startTime: s,
      endTime: e,
      duration: Math.floor((e - s) / 1000),
      type: 'MANUAL',
      status: 'STOPPED',
    })
    return null
  }

  return { active, running, elapsed, weekSeconds, start, pause, resume, stop, addManual }
}
