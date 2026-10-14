import { Role } from '../models'

// Permisos por rol. La interfaz oculta lo que el rol no puede usar; la
// seguridad real la imponen las reglas de Firestore (firestore.rules), así
// que si cambias algo aquí, mantén ambos lados alineados.
export type Permission =
  | 'users.manage'      // crear / editar / desactivar usuarios y asignar roles
  | 'clients.edit'      // crear y editar clientes
  | 'projects.edit'     // crear y editar proyectos
  | 'tasks.create'      // crear y asignar tareas
  | 'obligations.manage' // registrar y asignar obligaciones
  | 'reports.view'      // reportes
  | 'team.view'         // ver horas y avance de todo el equipo

const SUPERVISOR_PERMS: Permission[] = ['tasks.create', 'obligations.manage', 'reports.view', 'team.view']
const ADMIN_PERMS: Permission[] = [...SUPERVISOR_PERMS, 'users.manage', 'clients.edit', 'projects.edit']

const PERMS: Record<Role, Permission[]> = {
  OPERATOR: [],
  SUPERVISOR: SUPERVISOR_PERMS,
  ADMIN: ADMIN_PERMS,
  SUPERUSER: ADMIN_PERMS,
}

export function can(role: Role | undefined, permission: Permission): boolean {
  return !!role && PERMS[role].includes(permission)
}

export const ROLE_LABEL: Record<Role, string> = {
  OPERATOR: 'Operador / Colaborador',
  SUPERVISOR: 'Supervisor',
  ADMIN: 'Administrador',
  SUPERUSER: 'Superusuario',
}

// Resumen que se muestra al elegir un rol en "Nuevo usuario".
export const ROLE_SUMMARY: Record<Role, { can: string[]; cannot: string[] }> = {
  OPERATOR: {
    can: [
      'Ver su panel y las tareas que tiene asignadas',
      'Registrar tiempo (cronómetro y manual)',
      'Consultar obligaciones y completar las que tenga asignadas',
      'Recibir notificaciones',
    ],
    cannot: ['Ver clientes, proyectos ni reportes', 'Crear o asignar tareas', 'Gestionar usuarios'],
  },
  SUPERVISOR: {
    can: [
      'Todo lo del Operador',
      'Consultar clientes y proyectos',
      'Crear y asignar tareas y obligaciones',
      'Ver horas y avance de todo el equipo',
      'Consultar y exportar reportes',
    ],
    cannot: ['Crear o editar clientes y proyectos', 'Gestionar usuarios'],
  },
  ADMIN: {
    can: ['Todo lo del Supervisor', 'Crear y editar clientes y proyectos', 'Gestionar usuarios y asignar roles'],
    cannot: ['Crear o modificar cuentas de Superusuario'],
  },
  SUPERUSER: {
    can: ['Acceso total a todos los módulos', 'Gestionar usuarios, incluidos Administradores y Superusuarios'],
    cannot: [],
  },
}

// Roles que un usuario puede asignar al dar de alta o editar a otros.
export function assignableRoles(actor: Role | undefined): Role[] {
  if (actor === 'SUPERUSER') return ['OPERATOR', 'SUPERVISOR', 'ADMIN', 'SUPERUSER']
  if (actor === 'ADMIN') return ['OPERATOR', 'SUPERVISOR', 'ADMIN']
  return []
}

// Un Administrador no puede tocar cuentas de Superusuario.
export function canManageUser(actor: Role | undefined, target: Role): boolean {
  return actor === 'SUPERUSER' || (actor === 'ADMIN' && target !== 'SUPERUSER')
}
