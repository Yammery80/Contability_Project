import React, { useEffect, useState } from 'react'
import ActivityPicker, { PickerValue } from './ActivityPicker'
import { useTimer } from './useTimer'
import { clientsService } from '../clients/clientsService'
import { projectsService } from '../projects/projectsService'
import { tasksService } from '../tasks/tasksService'
import { formatClock } from '../../services/billing'
import { Client, Project, Task } from '../../models'

type Timer = ReturnType<typeof useTimer>

// Se abre al detener un cronómetro que se inició sin cliente, proyecto ni tarea.
// "Seguir contando" lo deja corriendo; el cronómetro no se detiene hasta guardar.
export default function StopTimerModal({ timer, onClose }: { timer: Timer; onClose: () => void }) {
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [pick, setPick] = useState<PickerValue>({ clientId: '', projectId: '', taskId: '' })
  const [description, setDescription] = useState(timer.active?.description ?? '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const u1 = clientsService.subscribe(setClients)
    const u2 = projectsService.subscribe(setProjects)
    const u3 = tasksService.subscribe(setTasks)
    return () => { u1(); u2(); u3() }
  }, [])

  // Esc cierra; si el cronómetro se detuvo desde otro lado, el diálogo ya no tiene sentido.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => { if (!timer.active) onClose() }, [timer.active, onClose])

  const save = async (assign: boolean) => {
    setBusy(true)
    try {
      if (assign) await timer.stopAndAssign({ ...pick, description: description.trim() })
      else await timer.stop()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const hasPick = !!(pick.clientId || pick.projectId || pick.taskId)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Guardar tiempo" onClick={(e) => e.stopPropagation()}>
        <h2>Guardar tiempo</h2>
        <div className="modal-duration">{formatClock(timer.elapsed)}</div>
        <p className="muted" style={{ margin: '0 0 .8rem', fontSize: '.85rem' }}>Asigna este tiempo a un cliente, proyecto o tarea.</p>
        <div className="modal-fields">
          <ActivityPicker clients={clients} projects={projects} tasks={tasks} value={pick} onChange={setPick} />
          <input placeholder="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button className="btn" disabled={busy || !hasPick} onClick={() => save(true)}>Guardar</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => save(false)}>Guardar sin asignar</button>
          <button className="btn btn-ghost" disabled={busy} onClick={onClose}>Seguir contando</button>
        </div>
        <p className="footnote" style={{ marginTop: '.7rem' }}>Si lo guardas sin asignar, el registro aparecerá sin cliente ni proyecto.</p>
      </div>
    </div>
  )
}
