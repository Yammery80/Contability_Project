
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

// Los valores se toman de variables de entorno (.env).
const useEmulators =
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: useEmulators
    ? 'demo-contability-test'
    : import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Validar las variables de configuración.
const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missing.length > 0) {
  throw new Error(
    `Faltan variables de entorno de Firebase: ${missing.join(', ')}. ` +
    'Revisa tu archivo .env y reinicia npm run dev.'
  )
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Conexiones locales, únicamente cuando se habilitan explícitamente.
if (useEmulators) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080)

  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  })

  console.info('Firebase conectado a los emuladores locales')
}
