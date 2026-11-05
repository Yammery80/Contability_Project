// Ejecutar con emulators:exec; todas las conexiones son locales.
import assert from 'node:assert/strict'
import { initializeApp, deleteApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator, setDoc, doc, getDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore'

const projectId = 'demo-hu29'
const host = process.env.FIRESTORE_EMULATOR_HOST
assert.match(host ?? '', /^(localhost|127\.0\.0\.1):\d+$/)
const [hostname, port] = host.split(':')
const apps = []
async function session(uid, role) {
  const url = 'http://' + host + '/v1/projects/' + projectId + '/databases/(default)/documents/users/' + uid
  const result = await fetch(url, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { active: { booleanValue: true }, role: { stringValue: role } } }) })
  assert.ok(result.ok, await result.text())
  const app = initializeApp({ projectId, apiKey: 'demo' }, uid)
  apps.push(app)
  const db = getFirestore(app)
  connectFirestoreEmulator(db, hostname, Number(port), { mockUserToken: { sub: uid } })
  return db
}

try {
  const worker = await session('operador', 'OPERATOR')
  const boss = await session('supervisor', 'SUPERVISOR')
  const now = Date.now()
  const entry = { userId: 'operador', clientId: '', projectId: '', taskId: '', description: 'Conciliación',
    startTime: now - 3601000, endTime: now - 1000, duration: 3600, type: 'MANUAL', status: 'STOPPED' }
  const pending = { entry, status: 'PENDING', reason: 'Sin conexión', requestedAt: serverTimestamp() }
  const unique = String(now)
  const request = db => doc(db, 'lateTimeRequests', unique)
  const hours = db => doc(db, 'timeEntries', unique)
  const decision = { status: 'APPROVED', reviewedAt: serverTimestamp(), reviewedBy: 'supervisor' }
  const denied = promise => assert.rejects(promise, error => error.code === 'permission-denied')

  await denied(setDoc(hours(worker), entry))
  await denied(setDoc(request(worker), { ...pending, reason: '  ' }))
  await setDoc(request(worker), pending)
  assert.equal((await getDoc(hours(boss))).exists(), false)
  await denied(updateDoc(request(worker), { ...decision, reviewedBy: 'operador' }))
  await denied(updateDoc(request(boss), decision))
  function approve(duration) {
    const batch = writeBatch(boss)
    batch.update(request(boss), decision)
    batch.set(hours(boss), { ...entry, duration, authorizationId: unique })
    return batch.commit()
  }
  await denied(approve(7200))
  await approve(3600)
  assert.equal((await getDoc(hours(worker))).data().duration, 3600)
  assert.equal((await getDoc(request(worker))).data().reviewedBy, 'supervisor')
  await denied(approve(3600))
  await denied(deleteDoc(request(boss)))
  await denied(updateDoc(hours(worker), { duration: 7200 }))
  const other = await session('otro', 'OPERATOR')
  await denied(getDoc(request(other)))
  const refused = doc(worker, 'lateTimeRequests', unique + '-r')
  await setDoc(refused, pending)
  await updateDoc(doc(boss, refused.path), { ...decision, status: 'REJECTED' })
  assert.equal((await getDoc(doc(boss, 'timeEntries', refused.id))).exists(), false)
  const timer = doc(worker, 'timeEntries', unique + '-t')
  await setDoc(timer, { ...entry, type: 'TIMER', status: 'RUNNING', startTime: Date.now(), endTime: null, duration: 0 })
  await updateDoc(timer, { status: 'PAUSED', startTime: null, duration: 0 })
  await updateDoc(timer, { status: 'RUNNING', startTime: Date.now() })
  await updateDoc(timer, { status: 'STOPPED', startTime: null, endTime: Date.now(), duration: 0 })
  console.log('HU-29: solicitud, aprobación atómica, permisos y evidencia verificados.')
} finally { await Promise.all(apps.map(deleteApp)) }
