
import React, { useEffect, useMemo, useState } from 'react'
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import type { EventProps, View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../../firebase/config'
import { useAuth, homeRouteForRole } from '../../hooks/useAuth'
import type { Task, Obligation, Project } from '../../models'

import {
  useSemaphoreSettings,
  saveSemaphoreSettings,
  semaphoreForDate,
  type SemaphoreSettings,
} from './semaphoreSettings'

import 'react-big-calendar/lib/css/react-big-calendar.css'

const locales = { es }

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) =>
    startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
})

type EventType = 'task' | 'obligation' | 'project'

interface FiscalEvent {
  id: string
  title: string
  start: Date
  end: Date
  allDay: boolean
  type: EventType
  sourceId: string
  status: string
  color: string
}

const messages = {
  allDay: 'Todo el día',
  previous: 'Anterior',
  next: 'Siguiente',
  today: 'Hoy',
  month: 'Mes',
  week: 'Semana',
  day: 'Día',
  agenda: 'Agenda',
  date: 'Fecha',
  time: 'Hora',
  event: 'Evento',
  noEventsInRange: 'No hay eventos en este periodo',
  showMore: (total: number) => `+${total} más`,
}

function parseLocalDate(value?: string): Date | null {
  if (!value) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function nextDay(date: Date): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + 1)
  return result
}

export default function FiscalCalendarPage() {
  const { profile } = useAuth()
  const { settings, error: settingsError } = useSemaphoreSettings()
  const [draft, setDraft] = useState<SemaphoreSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const canConfigure = profile?.role === 'ADMIN' ||
    profile?.role === 'SUPERUSER'

  const currentDraft = draft ?? settings

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    if (!canConfigure) return
    setSaving(true)
    setSaveMessage('')
    try {
      await saveSemaphoreSettings(currentDraft)
      setDraft(null)
      setSaveMessage('Configuración guardada correctamente.')
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : 'No se pudo guardar.'
      )
    } finally {
      setSaving(false)
    }
  }
  const navigate = useNavigate()

  const [tasks, setTasks] = useState<Task[]>([])
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<View>(Views.MONTH)
  const [date, setDate] = useState(new Date())
  const [filter, setFilter] = useState('all')

  const isOperator = profile?.role === 'OPERATOR'
  const base = profile ? homeRouteForRole(profile.role) : ''

  useEffect(() => {
    if (!profile) return

    let received = 0
    const expected = isOperator ? 2 : 3

    setLoading(true)
    setError('')
    setTasks([])
    setObligations([])
    setProjects([])

    const markReceived = () => {
      received += 1
      if (received >= expected) setLoading(false)
    }

    const handleError = (err: Error) => {
      console.error('Error al consultar calendario:', err)
      setError('No se pudieron cargar algunos eventos. Revisa los permisos de Firestore.')
      setLoading(false)
    }

    const taskQuery = isOperator
      ? query(
          collection(db, 'tasks'),
          where('assignedUserId', '==', profile.id)
        )
      : collection(db, 'tasks')

    const obligationQuery = isOperator
      ? query(
          collection(db, 'obligations'),
          where('assignedUserId', '==', profile.id)
        )
      : collection(db, 'obligations')

    const unsubTasks = onSnapshot(
      taskQuery,
      (snapshot) => {
        setTasks(snapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        } as Task)))
        markReceived()
      },
      handleError
    )

    const unsubObligations = onSnapshot(
      obligationQuery,
      (snapshot) => {
        setObligations(snapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        } as Obligation)))
        markReceived()
      },
      handleError
    )

    const unsubProjects = isOperator
      ? () => {}
      : onSnapshot(
          collection(db, 'projects'),
          (snapshot) => {
            setProjects(snapshot.docs.map((d) => ({
              ...d.data(),
              id: d.id,
            } as Project)))
            markReceived()
          },
          handleError
        )

    return () => {
      unsubTasks()
      unsubObligations()
      unsubProjects()
    }
  }, [profile?.id, isOperator])

  const events = useMemo<FiscalEvent[]>(() => {
    const result: FiscalEvent[] = []

    tasks.forEach((task) => {
      const due = parseLocalDate(task.dueDate)
      if (!due) return

      result.push({
        id: `task-${task.id}`,
        title: `Tarea: ${task.title}`,
        start: due,
        end: nextDay(due),
        allDay: true,
        type: 'task',
        sourceId: task.id,
        status: task.status,
        color: ({
          green: '#16a34a',
          yellow: '#eab308',
          red: '#dc2626',
        })[semaphoreForDate(
          task.dueDate,
          task.status === 'COMPLETED',
          settings
        )],
      })
    })

    obligations.forEach((obligation) => {
      const due = parseLocalDate(obligation.dueDate)
      if (!due) return

      result.push({
        id: `obligation-${obligation.id}`,
        title: `Obligación: ${obligation.name}`,
        start: due,
        end: nextDay(due),
        allDay: true,
        type: 'obligation',
        sourceId: obligation.id,
        status: obligation.status,
        color: ({
          green: '#16a34a',
          yellow: '#eab308',
          red: '#dc2626',
        })[semaphoreForDate(
          obligation.dueDate,
          obligation.status === 'DONE',
          settings
        )],
      })
    })

    projects.forEach((project) => {
      const start = parseLocalDate(project.startDate)
      const end = parseLocalDate(project.endDate)

      if (!start && !end) return

      const first = start || end!
      const last = end || start!

      const rangeStart =
        first.getTime() <= last.getTime() ? first : last

      const rangeEnd =
        first.getTime() <= last.getTime() ? last : first

      result.push({
        id: `project-${project.id}`,
        title: `Proyecto: ${project.name}`,
        start: rangeStart,
        end: nextDay(rangeEnd),
        allDay: true,
        type: 'project',
        sourceId: project.id,
        status: project.status,
        color: project.status === 'COMPLETED'
          ? '#16a34a'
          : '#2563eb',
      })
    })

    return result
  }, [tasks, obligations, projects, settings])

  const visibleEvents = useMemo(
    () => filter === 'all'
      ? events
      : events.filter((event) => event.type === filter),
    [events, filter]
  )

  const handleSelectEvent = (event: FiscalEvent) => {
    if (event.type === 'task') {
      navigate(`${base}/tasks/${event.sourceId}`)
    } else if (event.type === 'obligation') {
      navigate(`${base}/obligations`)
    } else if (event.type === 'project') {
      navigate(`${base}/projects`)
    }
  }

  const eventStyle = (
    event: FiscalEvent
  ): React.HTMLAttributes<HTMLDivElement> => ({
    style: {
      backgroundColor: event.color,
      borderColor: event.color,
      color: '#fff',
      borderRadius: '4px',
      fontSize: '12px',
      padding: '2px 4px',
    },
  })

  return (
    <div className="module-page">
      <h1>Calendario fiscal</h1>

      <p className="module-note">
        Consulta las fechas de tareas, obligaciones fiscales y
        proyectos registrados en el sistema.
      </p>

      {settingsError && <p role="alert">{settingsError}</p>}

      {canConfigure && (
        <form
          className="inline-form form-grid"
          onSubmit={handleSaveSettings}
          style={{ marginBottom: '1rem' }}
        >
          <strong>Configurar semáforo</strong>
          <label>
            Rojo: hasta cuántos días antes
            <input
              type="number"
              min={0}
              max={364}
              required
              value={currentDraft.redDays}
              onChange={(e) => setDraft({
                ...currentDraft,
                redDays: Number(e.target.value),
              })}
            />
          </label>
          <label>
            Amarillo: hasta cuántos días antes
            <input
              type="number"
              min={1}
              max={365}
              required
              value={currentDraft.yellowDays}
              onChange={(e) => setDraft({
                ...currentDraft,
                yellowDays: Number(e.target.value),
              })}
            />
          </label>
          <button type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </button>
          {saveMessage && <p role="status">{saveMessage}</p>}
        </form>
      )}

      <div
        className="inline-form"
        style={{ marginBottom: '1rem' }}
      >
        <label htmlFor="calendar-filter">
          Mostrar:
        </label>

        <select
          id="calendar-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Todos los eventos</option>
          <option value="task">Tareas</option>
          <option value="obligation">Obligaciones</option>
          {!isOperator && (
            <option value="project">Proyectos</option>
          )}
        </select>
      </div>

      <p style={{ marginBottom: '1rem' }}>
        <strong>Semáforo:</strong>{' '}
        <span style={{ color: '#16a34a' }}>● Verde</span>
        {' · '}
        <span style={{ color: '#eab308' }}>● Próximo</span>
        {' · '}
        <span style={{ color: '#dc2626' }}>● Vencido</span>
        {' · '}
        <span style={{ color: '#2563eb' }}>● Proyecto activo</span>
      </p>

      {loading && <p>Cargando eventos...</p>}
      {error && <p role="alert">{error}</p>}

      <div
        style={{
          background: 'var(--card, #fff)',
          padding: '1rem',
          borderRadius: '8px',
          minHeight: '650px',
        }}
      >
        <Calendar<FiscalEvent>
          localizer={localizer}
          events={visibleEvents}
          startAccessor="start"
          endAccessor="end"
          date={date}
          onNavigate={setDate}
          view={view}
          onView={setView}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          messages={messages}
          culture="es"
          popup
          selectable={false}
          style={{ height: 620 }}
          eventPropGetter={eventStyle}
          onSelectEvent={handleSelectEvent}
          tooltipAccessor={(event) =>
            `${event.title} — ${event.status}`
          }
        />
      </div>

      <p className="module-note">
        {visibleEvents.length} eventos disponibles.
        Los cambios guardados en Firestore se reflejan
        automáticamente en el calendario.
      </p>
    </div>
  )
}
