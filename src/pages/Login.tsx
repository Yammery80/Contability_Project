import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth, homeRouteForRole } from '../hooks/useAuth'
import { doc, getDoc } from 'firebase/firestore'
import { db, auth } from '../firebase/config'

export default function Login() {
  const { login } = useAuth()
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
        const role = snap.exists() ? (snap.data().role as string) : undefined
        navigate(homeRouteForRole(role as any), { replace: true })
      }
    } catch (err: any) {
      setError('Correo o contraseña incorrectos.')
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
