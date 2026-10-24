import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth, homeRouteForRole } from '../hooks/useAuth'
import { doc, getDoc } from 'firebase/firestore'
import { db, auth } from '../firebase/config'

// Antes cualquier fallo decía "correo o contraseña incorrectos", aunque fuera otra cosa.
function loginErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(code)) {
    return 'Correo o contraseña incorrectos.'
  }
  if (code === 'auth/too-many-requests') return 'Demasiados intentos. Espera unos minutos o restablece tu contraseña.'
  if (code === 'auth/user-disabled') return 'Esta cuenta está deshabilitada.'
  if (code === 'auth/network-request-failed') return 'Sin conexión. Revisa tu internet.'
  if (code === 'permission-denied') return 'Tus credenciales son correctas, pero no se pudo leer tu perfil. Revisa las reglas de Firestore.'
  if (code.startsWith('auth/')) return `No se pudo iniciar sesión (${code}).`
  return 'No se pudo iniciar sesión. Inténtalo de nuevo.'
}

export default function Login() {
  const { login, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as any
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(location.state?.error ?? null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(email, password)
      // Tras autenticar, consultamos el perfil para redirigir al home de su rol.
      const uid = auth.currentUser?.uid
      if (uid) {
        const snap = await getDoc(doc(db, 'users', uid))
        if (!snap.exists()) {
          await logout()
          setError('Tus credenciales son correctas, pero tu cuenta no tiene perfil en el sistema. Avisa a un administrador.')
          return
        }
        navigate(homeRouteForRole(snap.data().role as any), { replace: true })
      }
    } catch (err: unknown) {
      setError(loginErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <img src="/logo.png" alt="Logo" className="auth-logo" onError={(e) => { e.currentTarget.style.display = 'none' }} />
        <h1>Iniciar sesión</h1>
        <p className="auth-subtitle">Plataforma de gestión contable / fiscal</p>
        {error && <div className="auth-error">{error}</div>}
        <label>
          Correo electrónico
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
        <Link className="auth-link" to="/forgot-password">¿Olvidaste tu contraseña?</Link>
      </form>
    </div>
  )
}
