import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await resetPassword(email)
      setSent(true)
    } catch {
      setError('No se pudo enviar el correo de recuperación.')
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Recuperar contraseña</h1>
        {sent ? (
          <p>Revisa tu correo para continuar con la recuperación.</p>
        ) : (
          <>
            {error && <div className="auth-error">{error}</div>}
            <label>
              Correo electrónico
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <button type="submit">Enviar enlace</button>
          </>
        )}
        <Link className="auth-link" to="/login">Volver a iniciar sesión</Link>
      </form>
    </div>
  )
}
