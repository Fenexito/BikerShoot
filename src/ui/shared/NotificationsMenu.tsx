import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '../../features/auth/AuthContext'
import { useNotifications, markNotificationRead, markAllNotificationsRead, type AppNotification, type NotificationType } from '../../features/notifications/useNotifications'
import { IconCart, IconVerified } from './icons'
import { AnimateIcon } from '../animate-icons/icon'
import { Bell } from '../animate-icons/icons/Bell'
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

function NotificationRow({ notification, userId, index, onNavigate }: { notification: AppNotification; userId: string; index: number; onNavigate: () => void }) {
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
        {/* AnimatePresence propio (no depende de que la fila entera se
            desmonte) — al marcar como leída, este punto se encoge y se
            desvanece en vez de simplemente desaparecer de golpe. */}
        <AnimatePresence>
          {unread && (
            <motion.span
              layout
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-1.5 w-1.5 rounded-full bg-white"
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )

  function handleClick() {
    if (unread) markNotificationRead(userId, notification.id)
    onNavigate()
  }

  // Entrada escalonada al abrir el menú — cada fila aparece un poco
  // después de la anterior (`delay` por índice) en vez de que las 5-10
  // notificaciones aparezcan todas de golpe.
  const motionProps = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, delay: Math.min(index, 8) * 0.04, ease: 'easeOut' as const },
  }

  return notification.link ? (
    <motion.div {...motionProps}>
      <Link to={notification.link} onClick={handleClick}>
        {content}
      </Link>
    </motion.div>
  ) : (
    <motion.button {...motionProps} onClick={handleClick} className="block w-full text-left">
      {content}
    </motion.button>
  )
}

/** Panel de notificaciones — mismo patrón oscuro flotante que ProfileMenu.
 * Cada notificación trae su propio icono/color según tipo, para que el
 * fotógrafo distinga pedidos nuevos de cancelaciones de un vistazo sin
 * perder de vista el resto. */
export function NotificationsMenu() {
  const { user, profile } = useAuth()
  const { data: rawNotifications = [] } = useNotifications(user?.id)
  // Un tipo desactivado en Configuración > Notificaciones se sigue guardando
  // en el servidor (nunca se fabrica del lado del cliente), solo se oculta
  // aquí — así el usuario deja de verlo sin tocar el trigger que lo escribe.
  const notifications = rawNotifications.filter((n) => profile?.notification_prefs?.[n.type] !== false)
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
      <AnimateIcon animateOnHover animateOnTap asChild>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Notificaciones"
          title="Notificaciones"
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-border"
        >
          <Bell size={20} />
          {/* Rojo fijo (no `bg-primary`) a propósito — con `bg-primary` este
              badge se veía IDÉNTICO al del carrito (mismo azul, mismo
              lugar relativo), fácil de confundir de un vistazo; el rojo
              además garantiza contraste fuerte contra el fondo del botón
              en cualquiera de los dos temas, sin depender de qué tan claro
              u oscuro resuelva `--color-primary` en cada uno. */}
          {unread.length > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </button>
      </AnimateIcon>

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
              {notifications.map((n, i) => (
                <NotificationRow key={n.id} notification={n} userId={user!.id} index={i} onNavigate={() => setOpen(false)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
