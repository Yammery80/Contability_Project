import React from 'react'
import { Client, Project, Task } from '../../models'

export interface PickerValue {
  clientId: string
  projectId: string
  taskId: string
}

interface Props {
  clients: Client[]
  projects: Project[]
  tasks: Task[]
  value: PickerValue
  onChange: (v: PickerValue) => void
  required?: boolean
}

// Cliente → Proyecto → Tarea en cascada: cada lista solo ofrece lo que
// corresponde a la selección anterior (HU-23: los datos deben corresponder entre sí).
export default function ActivityPicker({ clients, projects, tasks, value, onChange, required }: Props) {
  const projectOptions = projects.filter((p) => !value.clientId || p.clientId === value.clientId)
  const taskOptions = tasks.filter((t) => !value.projectId || t.projectId === value.projectId)

  return (
    <>
      <select value={value.clientId} required={required} onChange={(e) => onChange({ clientId: e.target.value, projectId: '', taskId: '' })}>
        <option value="">Cliente…</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select value={value.projectId} required={required} onChange={(e) => onChange({ ...value, projectId: e.target.value, taskId: '' })}>
        <option value="">Proyecto…</option>
        {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select value={value.taskId} onChange={(e) => onChange({ ...value, taskId: e.target.value })}>
        <option value="">Tarea (opcional)…</option>
        {taskOptions.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
      </select>
    </>
  )
}
