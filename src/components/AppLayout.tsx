import React, { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { where } from 'firebase/firestore'
import { useAuth, homeRouteForRole } from '../hooks/useAuth'
import { notificationsService } from '../modules/notifications/notificationsService'
import { initials } from '../services/period'
import { can } from '../services/permissions'
import { Role } from '../models'

interface NavItem {
  label: string
  to: string
  section?: string // encabezado de grupo (p. ej. "Administración")
}

const nav = (base: string, extra: NavItem[] = [], withClients = true): NavItem[] => [
  { label: 'Dashboard', to: base },
  { label: 'Tablero de tareas', to: `${base}/tasks` },
  { label: 'Registro de tiempos', to: `${base}/time-tracker` },
  ...(withClients ? [{ label: 'Clientes', to: `${base}/clients` }, { label: 'Proyectos', to: `${base}/projects` }] : []),
  { label: 'Obligaciones', to: `${base}/obligations` },
  ...(withClients ? [{ label: 'Reportes', to: `${base}/reports` }] : []),
  { label: 'Notificaciones', to: `${base}/notifications` },
  ...extra,
]

// Superusuario y Administrador comparten menú (ambos con alcance total).
const ADMIN_NAV = nav('/admin', [{ label: 'Usuarios', to: '/admin/users', section: 'Administración' }])

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  SUPERUSER: ADMIN_NAV,
  ADMIN: ADMIN_NAV,
  SUPERVISOR: nav('/supervisor'),
  OPERATOR: nav('/operator', [], false),
}

const ROLE_LABEL: Record<Role, string> = {
  SUPERUSER: 'Superusuario',
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  OPERATOR: 'Operador / Colaborador',
}

function hideBrokenLogo(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = 'none'
}

export default function AppLayout() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!profile) return
    return notificationsService.subscribe(
      (items) => setUnread(items.filter((n) => !n.read).length),
      [where('userId', '==', profile.id)]
    )
  }, [profile])

  if (!profile) return null

  const base = homeRouteForRole(profile.role)
  const items = NAV_BY_ROLE[profile.role]
  const canCreateTask = can(profile.role, 'tasks.create')

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          {/* Coloca tu logo en /public/logo.png (si no existe, solo se ve el texto) */}
          <img src="/logo.png" alt="Logo" className="sidebar-logo" onError={hideBrokenLogo} />
          <span className="sidebar-brand-text">Proyecto Contable</span>
        </div>
        <nav>
          {items.map((item, i) => (
            <React.Fragment key={item.to}>
              {item.section && item.section !== items[i - 1]?.section && <div className="nav-section">{item.section}</div>}
              <NavLink
                to={item.to}
                end={item.to === base}
                className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
              >
                {item.label}
              </NavLink>
            </React.Fragment>
          ))}
        </nav>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <span className="role-badge">{ROLE_LABEL[profile.role]}</span>
          <span className="topbar-spacer" />
          {canCreateTask && (
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`${base}/tasks?new=1`)}>+ Nueva tarea</button>
          )}
          <button className="bell-btn" onClick={() => navigate(`${base}/notifications`)} aria-label="Notificaciones">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
          </button>
          <div className="avatar" title={profile.name}>{initials(profile.name)}</div>
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
