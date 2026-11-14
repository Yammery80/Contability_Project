// Datos de prueba para todo el equipo (Sprint 1).
//
// Crea usuarios (Auth + perfil), clientes, proyectos, tareas con historial de
// estados y registros de tiempo de las últimas ~6 semanas, para poder probar
// el detalle de proyecto (HU-18), el historial (HU-22) y el dashboard del
// equipo (HU-43).
//
// Todo lo que crea lleva `isSeed: true` y un ID fijo con prefijo "seed-",
// así que (a) volver a correrlo sobrescribe en vez de duplicar y (b) en el
// Sprint 4 se puede borrar con un filtro simple (where isSeed == true).
//
// USO (emuladores, recomendado):
//   firebase emulators:start --only auth,firestore
//   npm run seed
//
// Contra un proyecto real hace falta una cuenta de servicio y la bandera:
//   GOOGLE_APPLICATION_CREDENTIALS=ruta.json npm run seed -- --real
//
// Contraseña de todos los usuarios de prueba: Prueba123!

import admin from 'firebase-admin'

const REAL = process.argv.includes('--real')
const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST

if (!REAL) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'
}

admin.initializeApp({
  projectId: REAL ? process.env.GCLOUD_PROJECT : (process.env.GCLOUD_PROJECT ?? 'demo-contability-test'),
})
const db = admin.firestore()
const auth = admin.auth()

const PASSWORD = 'Prueba123!'
const DAY = 86400000
const now = Date.now()

// ---------- generador pseudo-aleatorio determinista ----------
let seedState = 42
const rand = () => {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296
  return seedState / 4294967296
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)]

const dateStr = (ms) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const inDays = (n) => dateStr(now + n * DAY)

// ---------- usuarios ----------
const USERS = [
  { id: 'seed-admin', name: 'Laura Mendoza', role: 'ADMIN', position: 'Socia directora' },
  { id: 'seed-sup-1', name: 'Ricardo Salas', role: 'SUPERVISOR', position: 'Supervisor fiscal' },
  { id: 'seed-sup-2', name: 'Patricia Núñez', role: 'SUPERVISOR', position: 'Supervisora contable' },
  { id: 'seed-op-1', name: 'Andrea Cruz', role: 'OPERATOR', position: 'Contadora senior' },
  { id: 'seed-op-2', name: 'Miguel Torres', role: 'OPERATOR', position: 'Contador junior' },
  { id: 'seed-op-3', name: 'Sofía Herrera', role: 'OPERATOR', position: 'Contadora junior' },
  { id: 'seed-op-4', name: 'Daniel Ortega', role: 'OPERATOR', position: 'Auxiliar contable' },
  { id: 'seed-op-5', name: 'Valeria Ríos', role: 'OPERATOR', position: 'Auxiliar fiscal' },
].map((u) => ({ ...u, email: `${u.id}@demo.test` }))

const operators = USERS.filter((u) => u.role === 'OPERATOR')
const byId = Object.fromEntries(USERS.map((u) => [u.id, u]))

// ---------- clientes y proyectos ----------
const CLIENTS = [
  { id: 'seed-cli-1', name: 'Grupo Textil del Valle SA de CV', type: 'LEGAL_ENTITY', responsibleUserId: 'seed-sup-1' },
  { id: 'seed-cli-2', name: 'Constructora Aurora SA de CV', type: 'LEGAL_ENTITY', responsibleUserId: 'seed-sup-2' },
  { id: 'seed-cli-3', name: 'Dr. Héctor Villanueva', type: 'PHYSICAL_PERSON', responsibleUserId: 'seed-sup-1' },
  { id: 'seed-cli-4', name: 'Café La Esquina SAPI', type: 'LEGAL_ENTITY', responsibleUserId: 'seed-sup-2' },
].map((c, i) => ({
  ...c,
  status: 'ACTIVE',
  email: `contacto${i + 1}@cliente-demo.test`,
  phone: `55 5000 000${i + 1}`,
  taxRegime: c.type === 'LEGAL_ENTITY' ? 'General de Ley Personas Morales' : 'Actividad empresarial y profesional',
  hasFiscalFile: false,
  createdAt: now - 120 * DAY,
}))

const PROJECTS = [
  { id: 'seed-pro-1', clientId: 'seed-cli-1', name: 'Declaración anual 2025', description: 'Cálculo y presentación de la declaración anual.', status: 'ACTIVE', supervisorId: 'seed-sup-1', start: -60, end: 30 },
  { id: 'seed-pro-2', clientId: 'seed-cli-1', name: 'Contabilidad mensual', description: 'Cierre contable mensual y estados financieros.', status: 'ACTIVE', supervisorId: 'seed-sup-1', start: -90, end: 90 },
  { id: 'seed-pro-3', clientId: 'seed-cli-2', name: 'Auditoría de obra', description: 'Revisión de costos por obra.', status: 'ACTIVE', supervisorId: 'seed-sup-2', start: -45, end: 45 },
  { id: 'seed-pro-4', clientId: 'seed-cli-3', name: 'Regularización fiscal', description: 'Aclaración de requerimientos SAT.', status: 'PLANNED', supervisorId: 'seed-sup-1', start: 5, end: 60 },
  { id: 'seed-pro-5', clientId: 'seed-cli-4', name: 'Nómina y cuotas IMSS', description: 'Cálculo quincenal de nómina.', status: 'COMPLETED', supervisorId: 'seed-sup-2', start: -120, end: -10 },
].map(({ start, end, ...p }) => ({ ...p, startDate: inDays(start), endDate: inDays(end) }))

// ---------- tareas ----------
// [proyecto, título, responsable, estado, prioridad, vence (días), horas estimadas]
const TASK_DEFS = [
  ['seed-pro-1', 'Recopilar CFDI del ejercicio', 'seed-op-1', 'COMPLETED', 'HIGH', -20, 10],
  ['seed-pro-1', 'Conciliar bancos del ejercicio', 'seed-op-2', 'COMPLETED', 'MEDIUM', -10, 14],
  ['seed-pro-1', 'Calcular ajuste anual de inflación', 'seed-op-1', 'IN_PROGRESS', 'HIGH', 3, 8],
  ['seed-pro-1', 'Preparar declaración para revisión', 'seed-op-3', 'IN_PROGRESS', 'HIGH', -2, 12],
  ['seed-pro-1', 'Presentar declaración en el portal SAT', 'seed-op-1', 'PENDING', 'HIGH', 20, 3],
  ['seed-pro-2', 'Cierre contable de octubre', 'seed-op-2', 'COMPLETED', 'MEDIUM', -8, 16],
  ['seed-pro-2', 'Cierre contable de noviembre', 'seed-op-2', 'IN_PROGRESS', 'MEDIUM', 12, 16],
  ['seed-pro-2', 'Estados financieros de noviembre', 'seed-op-4', 'PENDING', 'LOW', 18, 10],
  ['seed-pro-2', 'Depuración de cuentas por cobrar', 'seed-op-4', 'IN_PROGRESS', 'LOW', -1, 6],
  ['seed-pro-3', 'Revisión de facturas de proveedores', 'seed-op-3', 'COMPLETED', 'MEDIUM', -15, 20],
  ['seed-pro-3', 'Análisis de costos de la obra Norte', 'seed-op-5', 'IN_PROGRESS', 'HIGH', 5, 18],
  ['seed-pro-3', 'Análisis de costos de la obra Sur', 'seed-op-5', 'PENDING', 'MEDIUM', 15, 18],
  ['seed-pro-3', 'Informe de hallazgos', 'seed-op-3', 'PENDING', 'HIGH', 25, 8],
  ['seed-pro-4', 'Revisar requerimientos recibidos', 'seed-op-1', 'PENDING', 'HIGH', 10, 4],
  ['seed-pro-4', 'Integrar expediente de aclaración', 'seed-op-5', 'PENDING', 'MEDIUM', 30, 12],
  ['seed-pro-5', 'Cálculo de nómina quincena 1', 'seed-op-4', 'COMPLETED', 'MEDIUM', -50, 5],
  ['seed-pro-5', 'Cálculo de nómina quincena 2', 'seed-op-4', 'COMPLETED', 'MEDIUM', -35, 5],
  ['seed-pro-5', 'Conciliación de cuotas IMSS', 'seed-op-2', 'COMPLETED', 'LOW', -20, 6],
]

function buildTask(def, i) {
  const [projectId, title, assignedUserId, status, priority, dueIn, estimatedHours] = def
  const supervisorId = PROJECTS.find((p) => p.id === projectId).supervisorId
  const assignee = byId[assignedUserId]
  const supervisor = byId[supervisorId]
  const created = now - (40 + (i % 5) * 3) * DAY

  const history = []
  const log = (from, to, who, at) => history.push({ from, to, userId: who.id, userName: who.name, changedAt: at })

  const completionHistory = []
  let completedAt = 0
  let completedBy = ''

  if (status === 'IN_PROGRESS' || status === 'COMPLETED') {
    log('PENDING', 'IN_PROGRESS', assignee, created + 4 * DAY)
  }
  if (status === 'COMPLETED') {
    // Una tarea tiene un ciclo "se reabrió y se volvió a completar" para probar el historial.
    if (i === 1) {
      log('IN_PROGRESS', 'COMPLETED', assignee, now - 22 * DAY)
      log('COMPLETED', 'IN_PROGRESS', supervisor, now - 21 * DAY)
      completionHistory.push({ userId: assignee.id, userName: assignee.name, completedAt: now - 22 * DAY })
    }
    completedAt = now - Math.max(2, Math.abs(dueIn) - 2) * DAY
    completedBy = assignee.id
    log('IN_PROGRESS', 'COMPLETED', assignee, completedAt)
    completionHistory.push({ userId: assignee.id, userName: assignee.name, completedAt })
  }

  return {
    id: `seed-task-${String(i + 1).padStart(2, '0')}`,
    projectId,
    title,
    description: `Tarea de ejemplo: ${title.toLowerCase()}.`,
    assignedUserId,
    assignedBy: supervisorId,
    status,
    priority,
    dueDate: inDays(dueIn),
    createdAt: created,
    estimatedHours,
    subtasks: [],
    comments: [],
    statusHistory: history,
    ...(completedAt ? { completedAt, completedBy, completionHistory } : {}),
    isSeed: true,
  }
}

const TASKS = TASK_DEFS.map(buildTask)

// ---------- registros de tiempo ----------
// Días hábiles de las últimas 6 semanas; cada colaborador registra 1-3 bloques
// por día sobre sus propias tareas. Algunas semanas quedan bajo las 40 h.
function buildEntries() {
  const entries = []
  let n = 0
  for (let d = 42; d >= 0; d--) {
    const day = new Date(now - d * DAY)
    day.setHours(0, 0, 0, 0)
    const dow = day.getDay()
    if (dow === 0 || dow === 6) continue

    for (const op of operators) {
      const myTasks = TASKS.filter((t) => t.assignedUserId === op.id && t.createdAt + 5 * DAY <= day.getTime())
      if (myTasks.length === 0) continue
      // Daniel y Valeria registran menos horas (útil para ver contrastes en el dashboard).
      const lowLoad = op.id === 'seed-op-4' || op.id === 'seed-op-5'
      if (rand() < (lowLoad ? 0.35 : 0.08)) continue // día sin registro

      let cursor = day.getTime() + 9 * 3600000
      const blocks = 1 + Math.floor(rand() * 3)
      for (let b = 0; b < blocks; b++) {
        const task = pick(myTasks)
        const project = PROJECTS.find((p) => p.id === task.projectId)
        const hours = (lowLoad ? 1 : 1.5) + Math.floor(rand() * 4) * 0.5
        const start = cursor
        const end = start + hours * 3600000
        if (end > now) break
        n++
        entries.push({
          id: `seed-time-${String(n).padStart(4, '0')}`,
          userId: op.id,
          clientId: project.clientId,
          projectId: project.id,
          taskId: task.id,
          startTime: start,
          endTime: end,
          duration: Math.round(hours * 3600),
          description: task.title,
          type: rand() < 0.5 ? 'TIMER' : 'MANUAL',
          status: 'STOPPED',
          isSeed: true,
        })
        cursor = end + 30 * 60000
      }
    }
  }
  return entries
}

// ---------- escritura ----------
async function upsertAuthUser(u) {
  try {
    await auth.updateUser(u.id, { email: u.email, password: PASSWORD, displayName: u.name })
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err
    await auth.createUser({ uid: u.id, email: u.email, password: PASSWORD, displayName: u.name })
  }
}

async function writeAll(collection, docs) {
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch()
    docs.slice(i, i + 400).forEach(({ id, ...data }) => batch.set(db.collection(collection).doc(id), data))
    await batch.commit()
  }
}

async function main() {
  console.log(REAL ? 'Modo REAL: se escribirá en el proyecto configurado.' : `Emuladores: Firestore ${process.env.FIRESTORE_EMULATOR_HOST} / Auth ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`)

  for (const u of USERS) await upsertAuthUser(u)
  await writeAll('users', USERS.map(({ id, name, email, role, position }) => ({
    id, name, email, role, position, active: true, createdAt: now - 150 * DAY, mustChangePassword: false, isSeed: true,
  })))
  await writeAll('clients', CLIENTS.map((c) => ({ ...c, isSeed: true })))
  await writeAll('projects', PROJECTS.map((p) => ({ ...p, isSeed: true })))
  await writeAll('tasks', TASKS)
  const entries = buildEntries()
  await writeAll('timeEntries', entries)

  console.log(`Listo: ${USERS.length} usuarios, ${CLIENTS.length} clientes, ${PROJECTS.length} proyectos, ${TASKS.length} tareas, ${entries.length} registros de tiempo.`)
  console.log(`Acceso de prueba: seed-sup-1@demo.test (Supervisor) / seed-admin@demo.test (Admin) / seed-op-1@demo.test (Operador) — contraseña ${PASSWORD}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
