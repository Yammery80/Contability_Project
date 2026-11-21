// Ejecutar con el emulador de Firestore y FIRESTORE_EMULATOR_HOST definido.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, setLogLevel, updateDoc } from 'firebase/firestore'

assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(localhost|127\.0\.0\.1):\d+$/)
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
const env = await initializeTestEnvironment({ projectId: 'demo-report-details',
  firestore: { host, port: Number(port), rules: await readFile('firestore.rules', 'utf8') } })
setLogLevel('silent')
try {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore()
    const write = (path, data) => setDoc(doc(db, path), data)
    await Promise.all([
      write('users/s', { role: 'SUPERVISOR', active: true }), write('users/a', { role: 'ADMIN', active: true }),
      write('users/u', { role: 'OPERATOR', active: true }), write('clients/c', { name: 'Cliente demo' }),
      write('timeEntries/t', { status: 'STOPPED', userId: 'u', clientId: 'c', type: 'MANUAL', duration: 3600 }),
      write('timeEntries/r', { status: 'RUNNING', userId: 'u', clientId: 'c', type: 'TIMER' }),
      write('obligations/o', { status: 'PENDING', clientId: 'c', assignedUserId: 'u' }),
    ])
  })
  const store = uid => env.authenticatedContext(uid).firestore()
  const supervisor = store('s'), admin = store('a'), operator = store('u')
  const time = doc(supervisor, 'timeEntries/t')
  const reportDetail = { userId: 'u', responsibleName: 'Persona de prueba', clientId: 'c', clientName: 'Cliente demo',
    date: '2026-11-01', activity: 'Nómina', purpose: 'Documentar el pago de la quincena.' }
  await assertSucceeds(updateDoc(time, { reportDetail }))
  await assertSucceeds(updateDoc(doc(admin, 'obligations/o'), { reportDetail }))
  assert.equal((await getDoc(time)).data().duration, 3600)
  await assertFails(updateDoc(time, { reportDetail, duration: 7200 }))
  await assertFails(updateDoc(time, { reportDetail: { ...reportDetail, purpose: '   ' } }))
  await assertFails(updateDoc(time, { reportDetail: { ...reportDetail, clientId: 'otro' } }))
  await assertFails(updateDoc(doc(supervisor, 'timeEntries/r'), { reportDetail }))
  await assertFails(updateDoc(doc(operator, 'timeEntries/t'), { reportDetail }))
  await assertFails(updateDoc(doc(operator, 'obligations/o'), { reportDetail: { ...reportDetail, purpose: 'Otro motivo' } }))
  await assertFails(updateDoc(doc(supervisor, 'clients/c'), { businessActivity: 'Comercio' }))
  await assertSucceeds(updateDoc(doc(admin, 'clients/c'), { businessActivity: 'Comercio' }))
  console.log('Permisos y validación del detalle de reportes verificados.')
} finally {
  await env.cleanup()
}
