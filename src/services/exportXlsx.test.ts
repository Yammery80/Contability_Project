// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import ExcelJS from 'exceljs'
import { downloadXlsx, ReportData } from './exportReport'

const readBlob = (blob: Blob) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as ArrayBuffer)
    r.onerror = reject
    r.readAsArrayBuffer(blob)
  })

describe('downloadXlsx (HU-47)', () => {
  it('genera un Excel válido con filtros, fecha, números reales y formato', async () => {
    let captured: Blob | undefined
    let fileName = ''
    URL.createObjectURL = vi.fn((b: Blob) => { captured = b; return 'blob:x' }) as any
    URL.revokeObjectURL = vi.fn() as any
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { fileName = this.download })

    const report: ReportData = {
      title: 'Rentabilidad',
      generatedAt: new Date(2026, 10, 14, 9, 0),
      filters: [['Periodo', 'Noviembre 2026'], ['Cliente', 'Todos']],
      sections: [{ title: 'Margen', headers: ['Cliente', 'Horas', 'Ingreso (MXN)'], numFmts: [undefined, '0.00', '#,##0.00'], rows: [['=EVIL()', 12.5, 6250.4]] }],
    }
    await downloadXlsx(report)

    expect(click).toHaveBeenCalled()
    expect(fileName).toBe('reporte-rentabilidad-2026-11-14.xlsx')

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await readBlob(captured!))
    const ws = wb.getWorksheet('Reporte')!
    const rows: any[][] = []
    ws.eachRow({ includeEmpty: false }, (row) => rows.push((row.values as any[]).slice(1)))

    expect(rows[0][0]).toBe('Rentabilidad')
    expect(rows[1][0]).toBe('Fecha de generación')
    expect(rows[2]).toEqual(['Periodo', 'Noviembre 2026'])
    expect(rows[3]).toEqual(['Cliente', 'Todos'])
    const dataRow = ws.getRow(8)
    expect(typeof dataRow.getCell(2).value).toBe('number')
    expect(dataRow.getCell(2).numFmt).toBe('0.00')
    expect(dataRow.getCell(3).numFmt).toBe('#,##0.00')
    // texto con "=" queda como texto, no como fórmula
    expect(dataRow.getCell(1).value).toBe("'=EVIL()")
    click.mockRestore()
  })
})
