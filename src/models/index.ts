// ===== Roles =====
// Según HU-06: únicamente estos 4 roles. El cliente del despacho NO es un
// usuario del sistema (no inicia sesión) — solo existe como registro en la
// colección "clients" (ver interface Client más abajo).
export type Role = 'OPERATOR' | 'SUPERVISOR' | 'ADMIN' | 'SUPERUSER'

// ===== Usuario =====
export interface AppUser {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  createdAt: number
  phone?: string
  position?: string // puesto
}

// ===== Cliente =====
export type ClientType = 'PHYSICAL_PERSON' | 'LEGAL_ENTITY'
export type ClientStatus = 'ACTIVE' | 'PAUSED' | 'INACTIVE'

export interface Client {
  id: string
  name: string
  type: ClientType
  status: ClientStatus
  email: string
  phone: string
  createdAt: number
}

// ===== Proyecto =====
export type ProjectStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface Project {
  id: string
  clientId: string
  name: string
  description: string
  status: ProjectStatus
  startDate: string
  endDate: string
  supervisorId: string
}

// ===== Tarea =====
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface TaskComment {
  id: string
  userId: string
  userName: string
  text: string
  createdAt: number
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  assignedUserId: string
  assignedBy?: string // HU-20: quién realizó la asignación
  status: TaskStatus
  priority: TaskPriority
  dueDate: string
  createdAt: number
  estimatedHours?: number
  subtasks?: Subtask[]
  comments?: TaskComment[]
}

// ===== Registro de tiempo =====
export type TimeEntryType = 'TIMER' | 'MANUAL'

export interface TimeEntry {
  id: string
  userId: string
  clientId: string
  projectId: string
  taskId: string
  startTime: number | null
  endTime: number | null
  duration: number // segundos
  description: string
  type: TimeEntryType
  status: 'RUNNING' | 'PAUSED' | 'STOPPED'
}

// ===== Obligación =====
export type ObligationStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'OVERDUE'

export interface Obligation {
  id: string
  clientId: string
  name: string
  status: ObligationStatus
  dueDate: string
  assignedUserId: string
}

// ===== Notificación =====
export type NotificationLevel = 'INFO' | 'WARNING' | 'URGENT'

export interface AppNotification {
  id: string
  userId: string
  title: string
  message: string
  level: NotificationLevel
  read: boolean
  createdAt: number
}

// ===== Actividad capturada (Lea Memory) =====
// Una "actividad" es el tiempo continuo en un mismo dominio + título de página.
export type ActivitySource = 'chrome' | 'desktop' | 'google' | 'microsoft'

export interface Activity {
  id: string
  userId: string
  domain: string
  title: string
  startTime: number // ms
  endTime: number // ms
  duration: number // segundos
  source: ActivitySource
  createdAt: number
}

// ===== Aplicación a registrar (la define el administrador) =====
// Lea Memory solo captura actividad en los dominios de esta lista.
// "sat.gob.mx" también cubre sus subdominios (portal.sat.gob.mx).
export interface TrackedApp {
  id: string
  name: string
  domain: string
  active: boolean
  createdAt: number
  createdBy: string
}
