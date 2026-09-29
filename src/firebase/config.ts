import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Los valores se toman de variables de entorno (.env). Ver .env.example.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Si falta alguna variable, initializeApp() lanza un error y, sin manejo,
// la app queda en blanco sin ninguna pista en pantalla. Lo validamos aquí
// con un mensaje explícito (se muestra vía <ConfigErrorBoundary> en main.tsx).
const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missing.length > 0) {
  throw new Error(
    `Faltan variables de entorno de Firebase: ${missing.join(', ')}. ` +
    `Copia .env.example a .env y complétalo con las credenciales de tu proyecto ` +
    `(Consola de Firebase → Configuración del proyecto → Tus apps → SDK de Firebase). ` +
    `Después de editar .env, reinicia "npm run dev".`
  )
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
