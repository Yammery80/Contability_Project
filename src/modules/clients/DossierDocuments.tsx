import { useCallback, useEffect, useState } from 'react'
import { connectStorageEmulator, getBlob, getMetadata, getStorage, listAll, ref, uploadBytes, type FullMetadata } from 'firebase/storage'
import { app } from '../../firebase/config'
import type { AppUser, Client } from '../../models'

const local = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
const storage = local ? getStorage(app, 'gs://demo-contability-test.appspot.com') : getStorage(app)
if (local) connectStorageEmulator(storage, '127.0.0.1', 9199)

export default function DossierDocuments({ client, profile }: { client: Client; profile: AppUser }) {
  const [files, setFiles] = useState<FullMetadata[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const folder = 'clients/' + client.id + '/documents'
  const load = useCallback(async () => {
    const listing = await listAll(ref(storage, folder))
    return (await Promise.all(listing.items.map(item => getMetadata(item))))
      .sort((a,b) => b.timeCreated.localeCompare(a.timeCreated))
  }, [folder])
  useEffect(() => {
    let current = true
    load().then(items => { if (current) setFiles(items) })
      .catch(() => { if (current) setError('No se pudieron consultar los documentos. Verifica Storage y los permisos.') })
      .finally(() => { if (current) setLoaded(true) })
    return () => { current = false }
  }, [load])

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const file = new FormData(form).get('file')
    if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024 || file.name.length > 255)
      return setError('Selecciona un archivo de hasta 10 MiB con un nombre de hasta 255 caracteres.')
    setBusy(true)
    setError('')
    try {
      const result = await uploadBytes(ref(storage, folder + '/' + crypto.randomUUID()), file, {
        contentDisposition: 'attachment', customMetadata: { filename: file.name, authorId: profile.id, authorName: profile.name },
      })
      setFiles(items => [result.metadata, ...items.filter(item => item.fullPath !== result.metadata.fullPath)])
      form.reset()
    } catch { setError('No se pudo adjuntar el documento. Verifica la conexión y tus permisos.') }
    finally { setBusy(false) }
  }

  async function download(item: FullMetadata) {
    try {
      const url = URL.createObjectURL(await getBlob(ref(storage, item.fullPath)))
      const link = document.createElement('a')
      link.href = url
      link.download = item.customMetadata?.filename || item.name
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch { setError('No se pudo descargar. Comprueba los permisos y la configuración CORS del bucket.') }
  }
  return <section className="card"><h2>Documentos del expediente</h2>
    {(profile.role !== 'OPERATOR' || profile.id === client.responsibleUserId) &&
      <form onSubmit={upload}><label>Archivo <input name="file" type="file" required disabled={busy || !loaded} /></label>
        <button disabled={busy || !loaded}>{busy ? 'Subiendo…' : 'Adjuntar documento'}</button></form>}
    {error && <p role="alert">{error}</p>}
    {!loaded && <p>Cargando documentos…</p>}
    {loaded && !error && !files.length && <p>Sin documentos adjuntos.</p>}
    <ul>{files.map(item => <li key={item.fullPath}>
      <button type="button" onClick={() => download(item)}>{item.customMetadata?.filename || item.name}</button>
      {' · '}{new Date(item.timeCreated).toLocaleString('es-MX')}{' · '}{item.customMetadata?.authorName}
    </li>)}</ul>
  </section>
}
