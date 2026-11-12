import { TrackedApp } from '../../models'

// Nombre de la aplicación a la que pertenece un dominio (o el dominio mismo si no está en la lista).
// Un dominio pertenece si es igual al de la lista o es un subdominio suyo.
export function appNameOf(domain: string, apps: TrackedApp[]): string {
  return apps.find((a) => domain === a.domain || domain.endsWith('.' + a.domain))?.name ?? domain
}
