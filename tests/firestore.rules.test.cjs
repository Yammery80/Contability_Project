
const { test, after } = require('node:test')
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
  setDoc
} = require('firebase/firestore')

let env

const projectId = 'demo-contability-test'

// Configurar el entorno de pruebas
async function setup() {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: fs.readFileSync('firestore.rules', 'utf8')
    }
  })

  // Crear datos de prueba sin aplicar reglas de seguridad.
  // Esto solo afecta al emulador local.
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()

    await setDoc(doc(db, 'users', 'usuario1'), {
      role: 'OPERATOR',
      active: true,
      name: 'Usuario Uno'
    })

    await setDoc(doc(db, 'users', 'usuario2'), {
      role: 'OPERATOR',
      active: true,
      name: 'Usuario Dos'
    })

    await setDoc(doc(db, 'notifications', 'notificacion1'), {
      userId: 'usuario1',
      title: 'Tarea próxima a vencer',
      message: 'Tu tarea vence pronto',
      level: 'WARNING',
      read: false,
      createdAt: Date.now()
    })
  })
}

// Pruebas de seguridad de notificaciones
test('Seguridad de notificaciones', async (t) => {
  await setup()

  const db1 = env.authenticatedContext('usuario1').firestore()
  const db2 = env.authenticatedContext('usuario2').firestore()
  const dbAnon = env.unauthenticatedContext().firestore()

  // PRUEBA 1: Un usuario sin autenticación no puede leer.
  await t.test('Bloquear lectura sin autenticación', async () => {
    await assertFails(
      getDoc(doc(dbAnon, 'notifications', 'notificacion1'))
    )
  })

  // PRUEBA 2: Un usuario puede leer sus propias notificaciones.
  await t.test('Permitir lectura de notificación propia', async () => {
    await assertSucceeds(
      getDoc(doc(db1, 'notifications', 'notificacion1'))
    )
  })

  // PRUEBA 3: Un usuario no puede leer notificaciones ajenas.
  await t.test('Bloquear lectura de notificación ajena', async () => {
    await assertFails(
      getDoc(doc(db2, 'notifications', 'notificacion1'))
    )
  })

  // PRUEBA 4: El propietario puede marcar su notificación como leída.
  await t.test('Permitir marcar como leída una notificación propia', async () => {
    await assertSucceeds(
      updateDoc(doc(db1, 'notifications', 'notificacion1'), {
        read: true
      })
    )
  })

  // PRUEBA 5: No se permite modificar el título.
  await t.test('Bloquear modificación del título', async () => {
    await assertFails(
      updateDoc(doc(db1, 'notifications', 'notificacion1'), {
        title: 'Título modificado'
      })
    )
  })

  // PRUEBA 6: No se permite cambiar el destinatario.
  await t.test('Bloquear modificación del destinatario', async () => {
    await assertFails(
      updateDoc(doc(db1, 'notifications', 'notificacion1'), {
        userId: 'usuario2'
      })
    )
  })

  // PRUEBA 7: Otro usuario no puede actualizar la notificación.
  await t.test('Bloquear modificación por otro usuario', async () => {
    await assertFails(
      updateDoc(doc(db2, 'notifications', 'notificacion1'), {
        read: true
      })
    )
  })

  // PRUEBA 8: Detectar creación arbitraria de notificaciones.
  // Con las reglas actuales, esta prueba debería fallar.
  await t.test('Bloquear creación arbitraria de notificaciones', async () => {
    await assertFails(
      setDoc(doc(db1, 'notifications', 'notificacion-falsa'), {
        userId: 'usuario2',
        title: 'Alerta urgente falsa',
        message: 'Esta notificación no corresponde a una tarea real',
        level: 'URGENT',
        read: false,
        createdAt: Date.now()
      })
    )
  })
})

// Liberar los recursos del entorno de pruebas.
after(async () => {
  if (env) {
    await env.cleanup()
  }
})
