import { Bytes, collection, doc, getDocFromServer, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase/config'
import type { Client } from '../../models'

const types = {
  pdf: 'application/pdf',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
const signatures = { pdf: [37,80,68,70,45], xls: [208,207,17,224,161,177,26,225], xlsx: [80,75,3,4] }
export async function fiscalPayload(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'pdf' && ext !== 'xls' && ext !== 'xlsx') throw new Error('Selecciona un PDF o Excel (.xls o .xlsx).')
  if (!file.size || file.size > 900 * 1024) throw new Error('Elige un archivo con contenido de hasta 900 KiB.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!signatures[ext].every((value, index) => bytes[index] === value)) throw new Error('El contenido no coincide con la extensión seleccionada.')
  return { filename: file.name, mime: types[ext], content: Bytes.fromUint8Array(bytes), updatedAt: serverTimestamp() }
}

type ClientFields = Pick<Client, 'name' | 'type' | 'responsibleUserId' | 'phone' | 'email'>
export async function saveClientFile(id: string | null, fields: ClientFields, file: File) {
  const payload = await fiscalPayload(file)
  const ref = id ? doc(db, 'clients', id) : doc(collection(db, 'clients'))
  const batch = writeBatch(db)
  const data = { ...fields, hasFiscalFile: true }
  if (id) batch.update(ref, { ...data, updatedAt: Date.now() })
  else batch.set(ref, { ...data, status: 'ACTIVE', createdAt: Date.now() })
  batch.set(doc(ref, 'fiscal', 'regime'), payload)
  await batch.commit()
}

export async function downloadFiscalFile(id: string) {
  const data = (await getDocFromServer(doc(db, 'clients', id, 'fiscal', 'regime'))).data()
  if (!data || !(data.content instanceof Bytes)) throw new Error('Archivo no disponible.')
  const blob = new Blob([new Uint8Array(data.content.toUint8Array())], { type: data.mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = data.filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
