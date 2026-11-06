import React, { useState } from 'react'
import { useTimer, isUnassigned } from './useTimer'
import StopTimerModal from './StopTimerModal'
import { formatClock } from '../../services/billing'

// Botón de la barra superior (visible en todas las pantallas): un clic empieza a contar
// sin elegir nada; al detenerlo se asigna a un cliente, proyecto o tarea.
export default function QuickTimer() {
  const timer = useTimer({ activeOnly: true })
  const { active, running, elapsed } = timer
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    if (busy) return // evita crear dos cronómetros con un doble clic
    setBusy(true)
    setError(null)
    try {
      setError(await timer.start({ clientId: '', projectId: '', taskId: '', description: '' }))
    } catch {
      setError('No se pudo iniciar el cronómetro.')
    } finally {
      setBusy(false)
    }
  }

  const stop = () => (isUnassigned(active) ? setOpen(true) : timer.stop())

  if (!active) {
    return (
      <>
        {error && <span className="form-error" style={{ gridColumn: 'auto' }}>{error}</span>}
        <button className="btn btn-sm quick-start" onClick={start} disabled={busy} title="Empieza a contar tu tiempo ahora; después asignas cliente y proyecto">
          ▶ Iniciar ahora
        </button>
      </>
    )
  }

  return (
    <>
      <div className={'quick-timer' + (running ? ' running' : '')} title={active.description || 'Cronómetro en curso'}>
        <span className="qt-dot" />
        <span className="qt-clock">{formatClock(elapsed)}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => (running ? timer.pause() : timer.resume())} aria-label={running ? 'Pausar' : 'Reanudar'}>
          {running ? '⏸' : '▶'}
        </button>
        <button className="btn btn-danger btn-sm" onClick={stop}>⏹ Detener</button>
      </div>
      {open && <StopTimerModal timer={timer} onClose={() => setOpen(false)} />}
    </>
  )
}
