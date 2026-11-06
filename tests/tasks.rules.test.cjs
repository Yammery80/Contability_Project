
const {test, after} = require('node:test')
const fs = require('node:fs')

const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} = require('@firebase/rules-unit-testing')

const {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  deleteDoc
} = require('firebase/firestore')

const projectId = 'demo-contability-tasks-test'

let env

const taskPath = 'tasks/tarea-seguridad-1'

async function setup() {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: fs.readFileSync('firestore.rules', 'utf8')
    }
  })

  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()

    await setDoc(doc(db, 'users', 'operador1'), {
      name: 'Operador Uno',
      role: 'OPERATOR',
      active: true
    })

    await setDoc(doc(db, 'users', 'operador2'), {
      name: 'Operador Dos',
      role: 'OPERATOR',
      active: true
    })

    await setDoc(doc(db, 'users', 'supervisor1'), {
      name: 'Supervisor Uno',
      role: 'SUPERVISOR',
      active: true
    })

    await setDoc(doc(db, 'users', 'admin1'), {
      name: 'Administrador',
      role: 'ADMIN',
      active: true
    })

    await setDoc(doc(db, 'tasks', 'tarea-seguridad-1'), {
      projectId: 'proyecto-prueba',
      title: 'Tarea de seguridad',
      description: 'Validar permisos de Firestore',
      assignedUserId: 'operador1',
      assignedBy: 'supervisor1',
      status: 'PENDING',
      priority: 'MEDIUM',
      dueDate: '2026-11-15',
      createdAt: Date.now(),
      completedAt: 0,
      completedBy: '',
      completionHistory: [],
      comments: [],
      subtasks: [
        {
          id: 'subtarea1',
          title: 'Revisar documentos',
          done: false
        }
      ]
    })
  })
}

test('Seguridad de tareas', async (t) => {
  await setup()

  const operator = env.authenticatedContext('operador1').firestore()
  const otherOperator = env.authenticatedContext('operador2').firestore()
  const supervisor = env.authenticatedContext('supervisor1').firestore()
  const admin = env.authenticatedContext('admin1').firestore()
  const anonymous = env.unauthenticatedContext().firestore()

  await t.test('Bloquear lectura sin autenticacion', async () => {
    await assertFails(getDoc(doc(anonymous, taskPath)))
  })

  await t.test('Permitir lectura al operador activo', async () => {
    await assertSucceeds(getDoc(doc(operator, taskPath)))
  })

  await t.test('Bloquear edicion de tarea ajena', async () => {
    await assertFails(
      updateDoc(doc(otherOperator, taskPath), {
        status: 'IN_PROGRESS'
      })
    )
  })

  await t.test('Permitir cambiar estado de tarea asignada', async () => {
    await assertSucceeds(
      updateDoc(doc(operator, taskPath), {
        status: 'IN_PROGRESS'
      })
    )
  })

  await t.test('Permitir completar tarea asignada', async () => {
    const now = Date.now()

    await assertSucceeds(
      updateDoc(doc(operator, taskPath), {
        status: 'COMPLETED',
        completedAt: now,
        completedBy: 'operador1',
        completionHistory: [
          {
            userId: 'operador1',
            userName: 'Operador Uno',
            completedAt: now
          }
        ]
      })
    )
  })

  await t.test('Bloquear falsificacion del responsable', async () => {
    await assertFails(
      updateDoc(doc(operator, taskPath), {
        assignedUserId: 'operador2'
      })
    )
  })

  await t.test('Bloquear cambio de proyecto', async () => {
    await assertFails(
      updateDoc(doc(operator, taskPath), {
        projectId: 'otro-proyecto'
      })
    )
  })

  await t.test('Bloquear cambio de titulo', async () => {
    await assertFails(
      updateDoc(doc(operator, taskPath), {
        title: 'Titulo modificado'
      })
    )
  })

  await t.test('Permitir agregar comentario propio', async () => {
    await assertSucceeds(
      updateDoc(doc(operator, taskPath), {
        comments: [
          {
            id: 'comentario1',
            userId: 'operador1',
            userName: 'Operador Uno',
            text: 'Comentario de prueba',
            createdAt: Date.now()
          }
        ]
      })
    )
  })

  await t.test('Bloquear comentario con autor falso', async () => {
    await assertFails(
      updateDoc(doc(operator, taskPath), {
        comments: [
          {
            id: 'comentario1',
            userId: 'operador1',
            userName: 'Operador Uno',
            text: 'Comentario de prueba',
            createdAt: Date.now()
          },
          {
            id: 'comentario2',
            userId: 'operador2',
            userName: 'Operador Dos',
            text: 'Comentario falso',
            createdAt: Date.now()
          }
        ]
      })
    )
  })

  await t.test('Permitir completar subtarea', async () => {
    await assertSucceeds(
      updateDoc(doc(operator, taskPath), {
        subtasks: [
          {
            id: 'subtarea1',
            title: 'Revisar documentos',
            done: true
          }
        ]
      })
    )
  })

  await t.test('Bloquear eliminacion por operador', async () => {
    await assertFails(deleteDoc(doc(operator, taskPath)))
  })

  await t.test('Permitir edicion al supervisor', async () => {
    await assertSucceeds(
      updateDoc(doc(supervisor, taskPath), {
        description: 'Descripcion actualizada por supervisor'
      })
    )
  })

  await t.test('Permitir edicion al administrador', async () => {
    await assertSucceeds(
      updateDoc(doc(admin, taskPath), {
        priority: 'HIGH'
      })
    )
  })

  await t.test('Bloquear creacion por operador', async () => {
    await assertFails(
      setDoc(doc(operator, 'tasks', 'tarea-no-autorizada'), {
        title: 'Tarea no autorizada',
        assignedUserId: 'operador1',
        status: 'PENDING'
      })
    )
  })
})

after(async () => {
  if (env) {
    await env.cleanup()
  }
})
