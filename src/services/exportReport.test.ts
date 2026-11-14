import { describe, expect, it } from 'vitest'
import { buildCsv, reportFileName, ReportData } from './exportReport'

const gen = new Date(2026, 10, 14, 10, 30)
const report: ReportData = {
  title: 'Horas por cliente',
  generatedAt: gen,
  filters: [['Periodo', 'Noviembre 2026'], ['Cliente', 'Todos']],
  sections: [{ headers: ['Cliente', 'Horas'], rows: [['Textil, S.A. "Valle"', 12.5], ['Total', 12.5]] }],
}

describe('buildCsv (HU-47)', () => {
  const csv = buildCsv(report)
  const lines = csv.replace(/^\uFEFF/, '').split('\r\n')

  it('empieza con BOM y usa saltos CRLF', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('incluye título, fecha de generación y filtros arriba', () => {
    expect(lines[0]).toBe('Horas por cliente')
    expect(lines[1]).toMatch(/^Fecha de generación,/)
    expect(lines[1]).toContain('2026')
    expect(lines[2]).toBe('Periodo,Noviembre 2026')
    expect(lines[3]).toBe('Cliente,Todos')
  })

  it('escapa comas y comillas', () => {
    expect(csv).toContain('"Textil, S.A. ""Valle""",12.5')
  })

  it('separa secciones con una línea en blanco y respeta títulos de sección', () => {
    const two = buildCsv({ ...report, sections: [{ title: 'Uno', headers: ['A'], rows: [['x']] }, { title: 'Dos', headers: ['B'], rows: [['y']] }] })
    expect(two).toContain('Uno\r\nA\r\nx\r\n\r\nDos\r\nB\r\ny')
  })

  it('neutraliza texto que Excel interpretaría como fórmula, pero no los números negativos', () => {
    const c = buildCsv({ ...report, sections: [{ headers: ['N', 'V'], rows: [['=HYPERLINK("x")', -50], ['+cmd', null]] }] })
    expect(c).toContain(`"'=HYPERLINK(""x"")",-50`)
    expect(c).toContain("'+cmd,")
  })
})

describe('reportFileName', () => {
  it('arma un nombre sin acentos ni espacios con la fecha de generación', () => {
    expect(reportFileName('Rentabilidad por cliente', gen, 'csv')).toBe('reporte-rentabilidad-por-cliente-2026-11-14.csv')
    expect(reportFileName('Obligaciones fiscales ñandú', gen, 'xlsx')).toBe('reporte-obligaciones-fiscales-nandu-2026-11-14.xlsx')
  })
})
