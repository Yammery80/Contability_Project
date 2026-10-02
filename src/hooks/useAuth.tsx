import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { AppUser, Role } from '../models'

interface AuthContextValue {
  firebaseUser: FirebaseUser | null
  profile: AppUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser)
      if (fbUser) {
        // El perfil (rol, nombre, estado activo) vive en la colección "users",
        // indexada por el mismo uid que genera Firebase Authentication.
        const snap = await getDoc(doc(db, 'users', fbUser.uid))
        if (snap.exists()) {
          setProfile({ id: snap.id, ...snap.data() } as AppUser)
        } else {
          setProfile(null)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const logout = async () => {
    await signOut(auth)
  }

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email)
  }

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, loading, login, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

export function homeRouteForRole(role: Role | undefined): string {
  switch (role) {
    // Superusuario y Administrador comparten el mismo segmento de rutas
    // (/admin): según el documento de roles, ambos tienen alcance muy
    // similar (todos los módulos operativos). Si más adelante se necesita
    // diferenciar permisos finos entre ellos, se resuelve dentro de cada
    // página con profile.role, sin necesidad de duplicar rutas.
    case 'SUPERUSER':
    case 'ADMIN':
      return '/admin'
    case 'SUPERVISOR':
      return '/supervisor'
    case 'OPERATOR':
      return '/operator'
    default:
      return '/login'
  }
}
