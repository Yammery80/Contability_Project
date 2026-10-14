import { initializeApp, getApps } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, deleteUser, signOut } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { firebaseConfig, db } from './config'
import { AppUser } from '../models'

// Crea la cuenta de acceso (Firebase Authentication) y el perfil (Firestore,
// users/{uid}) de un nuevo colaborador.
//
// Se usa una SEGUNDA instancia de Firebase solo para crear la cuenta: si se
// usara la sesión principal, Firebase iniciaría sesión como el usuario nuevo
// y le cerraría la sesión al administrador que lo está dando de alta.
//
// Nota: asignar la contraseña desde el navegador es válido para este MVP.
// Lo más robusto a futuro es una Cloud Function con el Admin SDK.
export async function createUserWithPassword(data: Omit<AppUser, 'id'>, password: string): Promise<string> {
  const secondary = getApps().find((a) => a.name === 'secondary') ?? initializeApp(firebaseConfig, 'secondary')
  const secondaryAuth = getAuth(secondary)

  const cred = await createUserWithEmailAndPassword(secondaryAuth, data.email, password)
  try {
    // El perfil usa el uid de Authentication como ID (así lo busca useAuth al iniciar sesión).
    // Se escribe con la sesión del administrador (instancia principal).
    await setDoc(doc(db, 'users', cred.user.uid), data)
  } catch (err) {
    // Evita dejar una cuenta de acceso sin perfil.
    await deleteUser(cred.user).catch(() => undefined)
    throw err
  }
  await signOut(secondaryAuth)
  return cred.user.uid
}

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/email-already-in-use': return 'Ya existe una cuenta con ese correo.'
    case 'auth/invalid-email': return 'El correo no es válido.'
    case 'auth/weak-password': return 'La contraseña es muy débil (mínimo 6 caracteres).'
    case 'auth/operation-not-allowed': return 'El acceso con correo y contraseña no está habilitado en Firebase Authentication.'
    case 'auth/network-request-failed': return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.'
    case 'permission-denied': return 'No tienes permiso para guardar este usuario (revisa las reglas de Firestore).'
    default: return 'No se pudo completar la operación. Inténtalo de nuevo.'
  }
}
