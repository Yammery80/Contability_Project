import React, { useEffect, useState } from 'react'
import { where } from 'firebase/firestore'
import { notificationsService } from './notificationsService'
import { useAuth } from '../../hooks/useAuth'
import { AppNotification } from '../../models'

const LEVEL_LABEL: Record<string, string> = { INFO: 'Info', WARNING: 'Alerta', URGENT: 'Urgente' }

export default function NotificationsPage() {
  const { profile } = useAuth()
  const [items, setItems] = useState<AppNotification[]>([])

  useEffect(() => {
    if (!profile) return
    return notificationsService.subscribe(setItems, [where('userId', '==', profile.id)])
  }, [profile])

  const markRead = (n: AppNotification) => notificationsService.update(n.id, { read: true })

  return (
    <div className="module-page">
      <h1>Notificaciones</h1>
      <p className="module-note">Estructura base para alertas, urgencias y vencimientos. El disparo automático (obligaciones próximas a vencer, tareas atrasadas) se conectará en una siguiente iteración.</p>
      {items.length === 0 ? (
        <p>No hay notificaciones.</p>
      ) : (
        <ul className="notification-list">
          {items.sort((a, b) => b.createdAt - a.createdAt).map((n) => (
            <li key={n.id} className={'notification-item ' + n.level.toLowerCase() + (n.read ? ' read' : '')}>
              <span className="notification-level">{LEVEL_LABEL[n.level]}</span>
              <div>
                <strong>{n.title}</strong>
                <p>{n.message}</p>
              </div>
              {!n.read && <button onClick={() => markRead(n)}>Marcar leída</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
