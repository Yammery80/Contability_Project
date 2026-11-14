// HU-47: exportación de reportes a CSV o Excel. Todo reporte exportado lleva
// arriba su título, la fecha de generación y los filtros aplicados.

export type Cell = string | number | null

export interface ReportSection {
  title?: string
  headers: string[]
  rows: Cell[][]
  // Formato de número de Excel por columna (p. ej. '#,##0.00'); se ignora en CSV.
  numFmts?: (string | undefined)[]
}

export interface ReportData {
  title: string
  generatedAt: Date
  filters: [string, string][] // [etiqueta, valor]
  sections: ReportSection[]
}

export const FMT_HOURS = '0.00'
export const FMT_MONEY = '#,##0.00'
export const FMT_PCT = '0.0'

export function generatedLabel(d: Date): string {
  return d.toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })
}

// Nombre de archivo seguro: reporte-horas-por-cliente-2026-11-14.csv
export function reportFileName(title: string, generatedAt: Date, ext: 'csv' | 'xlsx'): string {
  const slug = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const day = `${generatedAt.getFullYear()}-${String(generatedAt.getMonth() + 1).padStart(2, '0')}-${String(generatedAt.getDate()).padStart(2, '0')}`
  return `reporte-${slug}-${day}.${ext}`
}

// Evita la inyección de fórmulas: una celda de texto que empieza con = + - @
// (o tabulador / retorno) la interpretaría Excel como fórmula.
function safeText(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
}

function csvCell(cell: Cell): string {
  if (cell === null) return ''
  const text = typeof cell === 'number' ? (Number.isFinite(cell) ? String(cell) : '') : safeText(cell)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const csvLine = (cells: Cell[]) => cells.map(csvCell).join(',')

export function buildCsv(report: ReportData): string {
  const lines: string[] = [
    csvLine([report.title]),
    csvLine(['Fecha de generación', generatedLabel(report.generatedAt)]),
    ...report.filters.map(([label, value]) => csvLine([label, value])),
  ]
  for (const section of report.sections) {
    lines.push('')
    if (section.title) lines.push(csvLine([section.title]))
    lines.push(csvLine(section.headers))
    section.rows.forEach((row) => lines.push(csvLine(row)))
  }
  // BOM para que Excel abra bien los acentos; saltos de línea CRLF.
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadCsv(report: ReportData) {
  triggerDownload(new Blob([buildCsv(report)], { type: 'text/csv;charset=utf-8' }), reportFileName(report.title, report.generatedAt, 'csv'))
}

// exceljs pesa bastante, así que solo se carga cuando alguien pide un Excel.
export async function downloadXlsx(report: ReportData) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.created = report.generatedAt
  const ws = wb.addWorksheet('Reporte')

  ws.addRow([report.title]).font = { bold: true, size: 14 }
  ws.addRow(['Fecha de generación', generatedLabel(report.generatedAt)])
  report.filters.forEach(([label, value]) => ws.addRow([label, value]))

  for (const section of report.sections) {
    ws.addRow([])
    if (section.title) ws.addRow([section.title]).font = { bold: true }
    const header = ws.addRow(section.headers)
    header.font = { bold: true }
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } }
    section.rows.forEach((row) => {
      const r = ws.addRow(row.map((c) => (typeof c === 'string' ? safeText(c) : c)))
      row.forEach((c, i) => {
        const fmt = section.numFmts?.[i]
        if (typeof c === 'number' && fmt) r.getCell(i + 1).numFmt = fmt
      })
    })
  }

  const widest = Math.max(0, ...report.sections.map((s) => s.headers.length))
  for (let i = 1; i <= widest; i++) ws.getColumn(i).width = i === 1 ? 38 : 20

  const buffer = await wb.xlsx.writeBuffer()
  triggerDownload(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    reportFileName(report.title, report.generatedAt, 'xlsx')
  )
}
