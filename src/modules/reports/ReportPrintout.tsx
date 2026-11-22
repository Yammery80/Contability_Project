import { useEffect, useState, type RefObject } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { FMT_MONEY, FMT_PCT, type Cell, type ReportData, type ReportSection } from '../../services/exportReport'
import type { ActivityRecord } from './activityDetail'
import './reportPrintout.css'

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const number = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 })
const issueDate = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short' })
const activityDate = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })

function displayCell(value: Cell, format?: string) {
  if (value === null || value === '') return '—'
  if (typeof value !== 'number') return value
  if (format === FMT_MONEY) return money.format(value)
  if (format === FMT_PCT) return number.format(value) + ' %'
  return number.format(value)
}

function SummaryTable({ section }: { section: ReportSection }) {
  const numeric = section.headers.map((_, i) => !!section.numFmts?.[i] || typeof section.rows[0]?.[i] === 'number')
  return <section className="rp-section">
    <h2>{section.title || 'Resumen del periodo'}</h2>
    <table className={section.headers.length > 5 ? 'rp-summary rp-summary-wide' : 'rp-summary'}>
      <thead><tr>{section.headers.map((header, i) =>
        <th key={header} scope="col" className={numeric[i] ? 'rp-number' : undefined}>{header}</th>)}</tr></thead>
      <tbody>{section.rows.map((row, index) =>
        <tr key={index} className={index === section.rows.length - 1 && row[0] === 'Total' ? 'rp-total' : undefined}>
          {row.map((value, i) => <td key={i} className={numeric[i] ? 'rp-number' : undefined}>
            {displayCell(value, section.numFmts?.[i])}</td>)}
        </tr>)}</tbody>
    </table>
  </section>
}

function Field({ label, value }: { label: string; value?: string }) {
  return value ? <div className="rp-field"><span>{label}</span> {value}</div> : null
}

function ActivityRow({ record }: { record: ActivityRecord }) {
  const { detail } = record
  const time = record.kind === 'timeEntries'
  const [project, task, start, end, duration] = time ? record.context : []
  const [status, completedAt, completedBy] = time ? [] : record.context
  return <tr>
    <td>
      <time dateTime={detail.date}>{activityDate.format(new Date(detail.date + 'T12:00:00'))}</time>
      <div className="rp-person">{detail.responsibleName}</div>
    </td>
    <td>
      <strong className="rp-activity-name">{detail.activity}</strong>
      <div className="rp-purpose"><span>Motivo</span> {detail.purpose}</div>
      <Field label="Proyecto" value={project} />
      <Field label="Tarea" value={task} />
    </td>
    <td>
      <strong className="rp-measure">{time ? duration : status}</strong>
      {time ? <>
        <Field label="Inicio" value={start || 'Sin registrar'} />
        <Field label="Fin" value={end || 'Sin registrar'} />
      </> : <>
        <Field label="Cumplida el" value={completedAt} />
        <Field label="Cumplida por" value={completedBy} />
      </>}
    </td>
  </tr>
}

function ClientTable({ records }: { records: ActivityRecord[] }) {
  const first = records[0]
  const time = first.kind === 'timeEntries'
  return <table className="rp-activities">
    <colgroup><col className="rp-who" /><col /><col className="rp-result" /></colgroup>
    <thead>
      <tr className="rp-client"><th colSpan={3}>
        <span className="rp-client-name">{first.detail.clientName}</span>
        <span className="rp-industry">Giro del cliente: {first.businessActivity || 'Sin registrar'}</span>
      </th></tr>
      <tr><th scope="col">{time ? 'Fecha y responsable' : 'Vencimiento y responsable'}</th>
        <th scope="col">Actividad y motivo</th>
        <th scope="col">{time ? 'Tiempo trabajado' : 'Cumplimiento'}</th></tr>
    </thead>
    <tbody>{records.map(record => <ActivityRow key={record.id} record={record} />)}</tbody>
  </table>
}

interface Props {
  report: ReportData | null
  records: ActivityRecord[]
  issuer?: string
  logoRef: RefObject<HTMLImageElement>
}

export default function ReportPrintout({ report, records, issuer, logoRef }: Props) {
  const [issuedAt, setIssuedAt] = useState(() => new Date())
  const period = report?.filters.find(([label]) => label === 'Periodo')?.[1]
  const printTitle = report && [report.title, period, 'Téllez Ponce & Asociados'].filter(Boolean).join(' - ')
  useEffect(() => {
    let previousTitle: string | undefined
    const beforePrint = () => {
      if (printTitle && previousTitle === undefined) {
        previousTitle = document.title
        document.title = printTitle
      }
      flushSync(() => setIssuedAt(new Date()))
    }
    const afterPrint = () => {
      if (previousTitle === undefined) return
      document.title = previousTitle
      previousTitle = undefined
    }
    window.addEventListener('beforeprint', beforePrint)
    window.addEventListener('afterprint', afterPrint)
    return () => {
      window.removeEventListener('beforeprint', beforePrint)
      window.removeEventListener('afterprint', afterPrint)
      afterPrint()
    }
  }, [printTitle])
  if (!report) return createPortal(<div className="report-printout"><p className="report-print-warning">
    El reporte está pendiente. Revisa los datos en Reportes antes de imprimirlo.</p></div>, document.body)

  const clients = new Map<string, ActivityRecord[]>()
  for (const record of records) {
    const group = clients.get(record.detail.clientId)
    if (group) group.push(record)
    else clients.set(record.detail.clientId, [record])
  }
  const filters = report.filters.filter(([label]) => label !== 'Nota')
  const notes = report.filters.filter(([label]) => label === 'Nota')
  return createPortal(<article className="report-printout" aria-label={'Reporte para impresión: ' + report.title}>
    <header className="rp-letterhead">
      <img ref={logoRef} src={import.meta.env.BASE_URL + 'logo.png'} alt="Logotipo de Téllez Ponce & Asociados" width="940" height="788" />
      <div><p className="rp-firm">Téllez Ponce &amp; Asociados</p><h1>{report.title}</h1></div>
    </header>
    <dl className="rp-metadata">
      {filters.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      <div><dt>Fecha de emisión</dt><dd>{issueDate.format(issuedAt)}</dd></div>
      {issuer && <div><dt>Emitido por</dt><dd>{issuer}</dd></div>}
    </dl>
    {report.sections.map((section, i) => <SummaryTable key={i} section={section} />)}
    {notes.map(([, note]) => <p className="rp-note" key={note}><strong>Observación.</strong> {note}</p>)}
    <section className="rp-section">
      <h2>Detalle de actividades por cliente</h2>
      {Array.from(clients, ([id, group]) => <ClientTable key={id} records={group} />)}
    </section>
  </article>, document.body)
}
