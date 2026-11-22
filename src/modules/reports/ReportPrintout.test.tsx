// @vitest-environment jsdom
import { createRef } from 'react'
import { act, cleanup, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ReportData } from '../../services/exportReport'
import type { ActivityRecord } from './activityDetail'
import ReportPrintout from './ReportPrintout'

const report: ReportData = { title: 'Horas por cliente', generatedAt: new Date(), filters: [['Periodo', 'Noviembre 2026']],
  sections: [{ headers: ['Cliente', 'Horas'], rows: [['Cliente de ejemplo', '02:00:00'], ['Total', '02:00:00']] }] }
const row: ActivityRecord = {
  id: '1', kind: 'timeEntries', sourceClientId: 'c', sourceDate: '2026-11-01', businessActivity: 'Comercio',
  detail: { clientId: 'c', clientName: 'Cliente de ejemplo', userId: 'u', responsibleName: 'Contadora de ejemplo',
    activity: 'Conciliación bancaria', purpose: 'Aclarar un depósito', date: '2026-11-01' },
  context: ['Cierre mensual', 'Verificar movimientos', '', '01/11/26 12:00', '01:00:00'],
}
afterEach(cleanup)

describe('Documento para impresión', () => {
  it('incluye el logo, el resumen y una tabla por cliente con una fila por actividad', () => {
    const logo = createRef<HTMLImageElement>()
    render(<ReportPrintout report={report} records={[row, { ...row, id: '2' }]} issuer="Revisor" logoRef={logo} />)
    const sheet = document.querySelector('article.report-printout')!
    expect(logo.current?.getAttribute('src')).toBe('/logo.png')
    expect(sheet.querySelector('ul, ol, li, button')).toBeNull()
    const tables = sheet.querySelectorAll('table')
    expect(tables).toHaveLength(2)
    expect(tables[1].tHead?.textContent).toContain('Giro del cliente: Comercio')
    expect(tables[1].tBodies[0].rows).toHaveLength(2)
    expect(within(tables[1].tBodies[0].rows[0]).getByText('Aclarar un depósito', { exact: false })).toBeTruthy()
    expect(tables[1].tBodies[0].rows[0].textContent).toContain('Contadora de ejemplo')
  })

  it('identifica el PDF por tipo y periodo y restaura el título de la aplicación al terminar', () => {
    const original = document.title
    render(<ReportPrintout report={report} records={[row]} logoRef={createRef<HTMLImageElement>()} />)
    act(() => { window.dispatchEvent(new Event('beforeprint')) })
    expect(document.title).toBe('Horas por cliente - Noviembre 2026 - Téllez Ponce & Asociados')
    act(() => { window.dispatchEvent(new Event('afterprint')) })
    expect(document.title).toBe(original)
  })

  it('al quedar pendiente elimina el contenido imprimible, incluso si antes estaba completo', () => {
    const props = { records: [row], logoRef: createRef<HTMLImageElement>() }
    const view = render(<ReportPrintout report={report} {...props} />)
    view.rerender(<ReportPrintout report={null} {...props} />)
    const sheet = document.querySelector('.report-printout')!
    expect(sheet.querySelector('table')).toBeNull()
    expect(sheet.textContent).toContain('El reporte está pendiente')
    expect(sheet.textContent).not.toContain(row.detail.clientName)
  })
})
