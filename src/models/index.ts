// ===== Roles =====
export type Role = 'CLIENT' | 'OPERATOR' | 'SUPERVISOR' | 'SUPERUSER'

// ===== Usuario =====
export interface AppUser {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  createdAt: number
}

// ===== Cliente =====
export type ClientType = 'PHYSICAL_PERSON' | 'LEGAL_ENTITY'
export type ClientStatus = 'ACTIVE' | 'INACTIVE'

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

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  assignedUserId: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: string
  createdAt: number
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
