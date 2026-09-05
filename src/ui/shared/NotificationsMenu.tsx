import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { useNotifications, markNotificationRead, markAllNotificationsRead, type AppNotification, type NotificationType } from '../../features/notifications/useNotifications'
import { IconBell, IconCart, IconVerified } from './icons'
import { cn } from '../../lib/cn'

const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  pedido_nuevo: <IconCart className="h-4 w-4" />,
  pedido_entregado: <span className="text-sm">✓</span>,
  pedido_cancelado: <span className="text-sm">✕</span>,
  fotografo_aprobado: <IconVerified className="h-4 w-4" />,
}

const TYPE_TONE: Record<NotificationType, string> = {
  pedido_nuevo: 'bg-blue-500/15 text-blue-400',
  pedido_entregado: 'bg-emerald-500/15 text-emerald-400',
  pedido_cancelado: 'bg-red-500/15 text-red-400',
  fotografo_aprobado: 'bg-blue-500/15 text-blue-400',
}

function timeAgoShort(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function NotificationRow({ notification, userId, onNavigate }: { notification: AppNotification; userId: string; onNavigate: () => void }) {
  const unread = !notification.read_at

  const content = (
    <div className={cn('flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/5', unread && 'bg-white/[0.03]')}>
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', TYPE_TONE[notification.type])}>
        {TYPE_ICON[notification.type]}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm', unread ? 'font-semibold text-white' : 'text-white/80')}>{notification.title}</p>
        {notification.body && <p className="truncate text-xs text-white/50">{notification.body}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-[10px] text-white/40">{timeAgoShort(notification.created_at)}</span>
        {unread && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </div>
    </div>
  )

  function handleClick() {
    if (unread) markNotificationRead(userId, notification.id)
    onNavigate()
  }

  return notification.link ? (
    <Link to={notification.link} onClick={handleClick}>
      {content}
    </Link>
  ) : (
    <button onClick={handleClick} className="block w-full text-left">
      {content}
    </button>
  )
}

/** Panel de notificaciones — mismo patrón oscuro flotante que ProfileMenu.
 * Cada notificación trae su propio icono/color según tipo, para que el
 * fotógrafo distinga pedidos nuevos de cancelaciones de un vistazo sin
 * perder de vista el resto. */
export function NotificationsMenu() {
  const { user } = useAuth()
  const { data: notifications = [] } = useNotifications(user?.id)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const unread = notifications.filter((n) => !n.read_at)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notificaciones"
        title="Notificaciones"
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-border"
      >
        <IconBell className="h-5 w-5" />
        {unread.length > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2 items-center justify-center rounded-full bg-primary" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-80 animate-menu-in overflow-hidden rounded-3xl border border-white/10 bg-neutral-900 text-white shadow-2xl">
          <div className="flex items-center justify-between px-5 pt-5">
            <p className="font-semibold">Notificaciones</p>
            {unread.length > 0 && user && (
              <button
                onClick={() => markAllNotificationsRead(user.id, unread.map((n) => n.id))}
                className="text-xs font-medium text-white/50 hover:text-white/80"
              >
                Marcar todo leído
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-8 py-10 text-center">
              <p className="font-semibold">Todavía no hay nada aquí</p>
              <p className="text-sm text-white/50">Te avisaremos cuando pase algo importante con tus pedidos.</p>
            </div>
          ) : (
            <div className="mt-3 max-h-96 overflow-y-auto border-t border-white/10 py-1">
              {notifications.map((n) => (
                <NotificationRow key={n.id} notification={n} userId={user!.id} onNavigate={() => setOpen(false)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
