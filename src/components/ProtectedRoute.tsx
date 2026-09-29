import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Role } from '../models'

interface Props {
  allowedRoles: Role[]
  children: React.ReactNode
}

// Envuelve cualquier ruta y exige: (1) sesión iniciada, (2) perfil activo,
// (3) rol autorizado para ese segmento (/client, /operator, /supervisor, /admin).
export function ProtectedRoute({ allowedRoles, children }: Props) {
  const { firebaseUser, profile, loading } = useAuth()

  if (loading) return <div className="page-loading">Cargando…</div>

  if (!firebaseUser || !profile) {
    return <Navigate to="/login" replace />
  }

  if (!profile.active) {
    return <Navigate to="/login" replace state={{ error: 'Tu cuenta está desactivada.' }} />
  }

  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
