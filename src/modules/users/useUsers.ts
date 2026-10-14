import { useEffect, useState } from 'react'
import { usersService } from './usersService'
import { useAuth } from '../../hooks/useAuth'
import { AppUser } from '../../models'

// Lista de usuarios. Las reglas de Firestore solo dejan listar la colección
// completa a Supervisor/Administrador/Superusuario; el Operador solo ve su perfil.
export function useUsers(): AppUser[] {
  const { profile } = useAuth()
  const [users, setUsers] = useState<AppUser[]>([])
  useEffect(() => {
    if (!profile) return
    if (profile.role === 'OPERATOR') {
      setUsers([profile])
      return
    }
    return usersService.subscribe(setUsers)
  }, [profile])
  return users
}
