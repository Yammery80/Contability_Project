import React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Role } from '../models'

interface NavItem {
  label: string
  to: string
}

// Superusuario y Administrador comparten exactamente el mismo menú: según
// el documento de roles, ambos tienen alcance a todos los módulos
// operativos (usuarios, clientes, proyectos, tareas, obligaciones, reportes).
const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', to: '/admin' },
  { label: 'Usuarios', to: '/admin/users' },
  { label: 'Clientes', to: '/admin/clients' },
  { label: 'Proyectos', to: '/admin/projects' },
  { label: 'Tareas', to: '/admin/tasks' },
  { label: 'Time Tracker', to: '/admin/time-tracker' },
  { label: 'Obligaciones', to: '/admin/obligations' },
  { label: 'Reportes', to: '/admin/reports' },
  { label: 'Notificaciones', to: '/admin/notifications' },
]

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  SUPERUSER: ADMIN_NAV,
  ADMIN: ADMIN_NAV,
  SUPERVISOR: [
    { label: 'Dashboard', to: '/supervisor' },
    { label: 'Clientes', to: '/supervisor/clients' },
    { label: 'Proyectos', to: '/supervisor/projects' },
    { label: 'Tareas', to: '/supervisor/tasks' },
    { label: 'Time Tracker', to: '/supervisor/time-tracker' },
    { label: 'Obligaciones', to: '/supervisor/obligations' },
    { label: 'Reportes', to: '/supervisor/reports' },
    { label: 'Notificaciones', to: '/supervisor/notifications' },
  ],
  OPERATOR: [
    { label: 'Dashboard', to: '/operator' },
    { label: 'Mis tareas', to: '/operator/tasks' },
    { label: 'Time Tracker', to: '/operator/time-tracker' },
    { label: 'Obligaciones', to: '/operator/obligations' },
    { label: 'Notificaciones', to: '/operator/notifications' },
  ],
}

const ROLE_LABEL: Record<Role, string> = {
  SUPERUSER: 'Superusuario',
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  OPERATOR: 'Operador / Colaborador',
}

export default function AppLayout() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  if (!profile) return null

  const items = NAV_BY_ROLE[profile.role]

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">Proyecto Contable</div>
        <nav>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.split('/').length === 2}
              className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <span className="role-badge">{ROLE_LABEL[profile.role]}</span>
          <span className="user-name">{profile.name}</span>
          <button className="logout-btn" onClick={handleLogout}>Salir</button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
