import { describe, expect, it } from 'vitest'
import type { AppUser, Client, Obligation, Project, Task, TimeEntry } from '../../models'
import { activitySection, indexById, missingFields, obligationActivity, reportedTime, selectActivities, timeActivity, validDay } from './activityDetail'

const directory = {
  clients: indexById([{ id: 'c', name: 'Cliente de prueba', businessActivity: 'Comercio' } as Client]),
  users: indexById([{ id: 'u', name: 'Contadora de prueba' } as AppUser]),
  projects: indexById([{ id: 'p', clientId: 'c', name: 'Cierre mensual' } as Project]),
  tasks: indexById([{ id: 't', projectId: 'p', title: 'Conciliación bancaria' } as Task]),
}
const end = new Date(2026, 10, 6, 14).getTime()
const entry: TimeEntry = { id: 'e', clientId: '', userId: 'u', projectId: '', taskId: 't', description: '',
  startTime: null, endTime: end, duration: 1800, type: 'TIMER', status: 'STOPPED' }
const duty: Obligation = { id: 'o', clientId: 'c', assignedUserId: 'u', name: 'Emitir comprobante', dueDate: '2026-11-07', status: 'PENDING' }

describe('Detalle obligatorio de Reportes', () => {
  it('recupera el cliente y la actividad reales de la tarea y deja el motivo pendiente', () => {
    const row = timeActivity(entry, directory)
    expect(row.detail).toMatchObject({ clientId: 'c', clientName: 'Cliente de prueba', responsibleName: 'Contadora de prueba',
      activity: 'Conciliación bancaria', purpose: '', date: '2026-11-06' })
    expect(missingFields(row.detail)).toEqual(['motivo'])
    expect(row.context).toEqual(['Cierre mensual', 'Conciliación bancaria', '', expect.any(String), '00:30:00'])
    expect(reportedTime(entry, row)).toMatchObject({ clientId: 'c', startTime: null, duration: 1800 })
    expect(entry.clientId).toBe('')
  })

  it('mantiene cada registro separado y exporta lo mismo que la vista detallada', () => {
    const original = timeActivity(entry, directory)
    const saved = { ...original.detail, purpose: 'Aclarar una diferencia en el cierre.' }
    const manual = timeActivity({ ...entry, id: 'e2', startTime: end - 1800000, type: 'MANUAL', reportDetail: saved }, directory)
    const timer = timeActivity({ ...entry, reportDetail: saved }, directory)
    const section = activitySection('timeEntries', [timer, manual])
    expect(missingFields(timer.detail)).toEqual([])
    expect(section.rows).toHaveLength(2)
    expect(section.rows[0]).toEqual(['Contadora de prueba', 'Cliente de prueba', 'Comercio', 'Conciliación bancaria',
      saved.purpose, '2026-11-06', 'Cierre mensual', 'Conciliación bancaria', '', expect.any(String), '00:30:00'])
    expect(section.rows[1][8]).toBeTruthy()
  })

  it('conserva nombres confirmados si desaparece una ficha y descarta motivos de otro cliente', () => {
    const saved = { ...timeActivity(entry, directory).detail, purpose: 'Motivo confirmado' }
    const row = timeActivity({ ...entry, clientId: 'c', reportDetail: saved }, { ...directory, users: new Map(), clients: new Map() })
    expect(missingFields(row.detail)).toEqual([])
    expect(row.businessActivity).toBe('')
    const reassigned = timeActivity({ ...entry, clientId: 'otro', reportDetail: saved }, directory)
    expect(missingFields(reassigned.detail)).toEqual(['cliente', 'motivo'])
  })

  it('rechaza blancos y fechas imposibles y recupera un día documentado sin inventar horas', () => {
    const old = { ...entry, clientId: '', taskId: '', userId: 'antiguo', endTime: null }
    const row = timeActivity(old, directory)
    expect(missingFields(row.detail)).toHaveLength(5)
    const saved = { ...row.detail, clientId: 'c', date: '2026-11-02', responsibleName: 'Responsable histórico', activity: 'Nómina', purpose: '   ' }
    const annotated = timeActivity({ ...old, reportDetail: saved }, directory)
    expect(missingFields(annotated.detail)).toEqual(['motivo'])
    expect(annotated.context.slice(2, 4)).toEqual(['', ''])
    expect(validDay('2026-02-30')).toBe(false)
    expect(validDay('2028-02-29')).toBe(true)
  })

  it('distingue vencimiento, cumplimiento y persona que completó la obligación', () => {
    const pending = obligationActivity(duty, directory)
    expect(pending.context).toEqual(['Pendiente', '', ''])
    const done = obligationActivity({ ...duty, status: 'DONE', completedAt: end, completedByName: 'Otra persona',
      reportDetail: { ...pending.detail, purpose: 'Documentar el pago del cliente.' } }, directory)
    const section = activitySection('obligations', [done])
    expect(section.rows[0]).toHaveLength(section.headers.length)
    expect(section.rows[0].slice(5)).toEqual(['2026-11-07', 'Cumplida', expect.any(String), 'Otra persona'])
  })

  it('aplica cliente, responsable y límites de mes e identifica registros sin fecha del mismo ámbito', () => {
    const november = new Date(2026, 10, 1).getTime(), december = new Date(2026, 11, 1).getTime()
    const row = (id: string, patch: Partial<TimeEntry>) => ({ record: timeActivity({ ...entry, id, ...patch }, directory) })
    const data = [row('en-periodo', { endTime: november }), row('siguiente-mes', { endTime: december }),
      row('otro-cliente', { clientId: 'otro' }), row('otra-persona', { userId: 'otra' }),
      row('sin-fecha', { endTime: null }), row('ajeno-sin-fecha', { clientId: 'otro', endTime: null })]
    const result = selectActivities(data, 'c', 'u', [november, december])
    expect(result.dated.map(item => item.record.id)).toEqual(['en-periodo'])
    expect(result.undated.map(item => item.id)).toEqual(['sin-fecha'])
  })
})
