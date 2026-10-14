import React, { useEffect, useMemo, useState } from 'react'
import { where } from 'firebase/firestore'
import { notificationsService } from './notificationsService'
import { useAuth } from '../../hooks/useAuth'
import { timeAgo } from '../../services/period'
import { AppNotification } from '../../models'

export default function NotificationsPage() {
  const { profile } = useAuth()
  const [items, setItems] = useState<AppNotification[]>([])

  useEffect(() => {
    if (!profile) return
    return notificationsService.subscribe(setItems, [where('userId', '==', profile.id)])
  }, [profile])

  const sorted = useMemo(() => [...items].sort((a, b) => b.createdAt - a.createdAt), [items])
  const unread = sorted.filter((n) => !n.read)

  const markRead = (n: AppNotification) => !n.read && notificationsService.update(n.id, { read: true })
  const markAll = () => Promise.all(unread.map((n) => notificationsService.update(n.id, { read: true })))

  return (
    <div className="module-page">
      <h1>Notificaciones</h1>
      <p className="page-subtitle">Avisos del sistema</p>

      {unread.length > 0 && (
        <div className="toolbar">
          <button className="btn btn-ghost btn-sm push-right" onClick={markAll}>Marcar todas como leídas ({unread.length})</button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="empty-state">No tienes notificaciones.</div>
      ) : (
        <ul className="notification-list">
          {sorted.map((n) => (
            <li key={n.id} className={'notification-item' + (n.read ? '' : ' unread') + (n.level === 'URGENT' ? ' urgent' : '')} onClick={() => markRead(n)}>
              <span className="notification-dot" />
              <div>
                <div className="notification-title">{n.title}</div>
                {n.message && <div className="notification-time">{n.message}</div>}
                <div className="notification-time">{timeAgo(n.createdAt)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="footnote">
        Se generan al asignar una tarea, completarla o comentar en ella. Los avisos por proximidad de vencimiento y el envío por correo requieren una Cloud Function (HU-39) y aún no están activos.
      </p>
    </div>
  )
}
