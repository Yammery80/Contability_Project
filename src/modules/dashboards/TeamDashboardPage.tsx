import React, { useEffect, useMemo, useState } from 'react'
import { tasksService } from '../tasks/tasksService'
import { isOverdue } from '../tasks/TasksPage'
import { timeEntriesService, startOfWeek } from '../timeTracker/timeTrackerService'
import { useUsers } from '../users/useUsers'
import { useAuth } from '../../hooks/useAuth'
import { formatHours } from '../../services/billing'
import { currentMonthValue, initials, monthOptions, monthRange } from '../../services/period'
import { Task, TimeEntry } from '../../models'
import { buildTeamStats, WEEKLY_TARGET_HOURS } from './teamStats'

// HU-43: dashboard del equipo para el Supervisor (también disponible para Admin).
// Muestra, por colaborador, las horas de la semana (contra la meta de 40 h),
// las horas del periodo y el estado de sus tareas.
export default function TeamDashboardPage() {
  const { profile } = useAuth()
  const users = useUsers()
  const [tasks, setTasks] = useState<Task[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [period, setPeriod] = useState(currentMonthValue())
  const [onlyProblems, setOnlyProblems] = useState(false)

  useEffect(() => {
    const u1 = tasksService.subscribe(setTasks)
    const u2 = timeEntriesService.subscribe(setEntries)
    return () => { u1(); u2() }
  }, [])

  // El equipo son los colaboradores activos (rol Operador).
  const members = useMemo(() => users.filter((u) => u.role === 'OPERATOR' && u.active), [users])

  const stats = useMemo(
    () => buildTeamStats(members, tasks, entries, startOfWeek(), monthRange(period), isOverdue),
    [members, tasks, entries, period]
  )

  if (!profile) return null

  const rows = stats
    .filter((s) => !onlyProblems || s.overdueTasks > 0 || s.weekSeconds < (WEEKLY_TARGET_HOURS * 3600) * 0.5)
    .sort((a, b) => b.weekSeconds - a.weekSeconds)

  const totalWeek = stats.reduce((s, r) => s + r.weekSeconds, 0)
  const totalMonth = stats.reduce((s, r) => s + r.monthSeconds, 0)
  const totalActive = stats.reduce((s, r) => s + r.activeTasks, 0)
  const totalOverdue = stats.reduce((s, r) => s + r.overdueTasks, 0)
  const workingNow = stats.filter((s) => s.runningNow).length

  return (
    <div className="module-page">
      <h1>Dashboard del equipo</h1>
      <p className="page-subtitle">Horas y avance de {members.length} colaboradores activos</p>

      <div className="toolbar">
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          {monthOptions().map((m) => <option key={m.value} value={m.value}>Periodo: {m.label}</option>)}
        </select>
        <label className="muted" style={{ display: 'flex', gap: '.4rem', alignItems: 'center', fontSize: '.85rem' }}>
          <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
          Solo con pendientes de atención
        </label>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Horas esta semana</span>
          <span className="stat-value">{formatHours(totalWeek)}</span>
          <span className="stat-sub">meta del equipo: {members.length * WEEKLY_TARGET_HOURS} h</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Horas del periodo</span>
          <span className="stat-value">{formatHours(totalMonth)}</span>
          <span className="stat-sub">{workingNow} {workingNow === 1 ? 'persona' : 'personas'} con cronómetro activo</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Tareas activas</span>
          <span className="stat-value">{totalActive}</span>
          <span className="stat-sub">asignadas al equipo</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Tareas vencidas</span>
          <span className="stat-value">{totalOverdue}</span>
          <span className="stat-sub">requieren atención</span>
        </div>
      </div>

      <div className="card">
        <h2>Colaboradores <small>semana actual vs. meta de {WEEKLY_TARGET_HOURS} h</small></h2>
        {rows.length === 0 ? (
          <p className="module-note">No hay colaboradores que mostrar.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th style={{ width: '24%' }}>Semana</th>
                <th className="num">Periodo</th>
                <th className="num">Activas</th>
                <th className="num">Vencidas</th>
                <th className="num">Completadas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = Math.min(100, (r.weekSeconds / (WEEKLY_TARGET_HOURS * 3600)) * 100)
                return (
                  <tr key={r.user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                        <div className="avatar avatar-sm">{initials(r.user.name)}</div>
                        <div>
                          {r.user.name}
                          {r.runningNow && <small style={{ color: 'var(--ok)', marginLeft: '.4rem' }}>● en curso</small>}
                          <br /><small className="muted">{r.user.position ?? 'Colaborador'}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
                      <small className="muted">{formatHours(r.weekSeconds)} / {WEEKLY_TARGET_HOURS} h</small>
                    </td>
                    <td className="num">{formatHours(r.monthSeconds)}</td>
                    <td className="num">{r.activeTasks}</td>
                    <td className={'num' + (r.overdueTasks > 0 ? ' overdue' : '')}>{r.overdueTasks}</td>
                    <td className="num">{r.completedInPeriod}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
