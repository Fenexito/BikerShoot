import { useEffect, useRef, useState } from 'react'
import { IconBell } from './icons'

/** Panel de notificaciones — mismo patrón oscuro flotante que ProfileMenu.
 * Sin backend de notificaciones todavía, así que siempre muestra el estado
 * vacío (igual que hace Mobbin la primera vez que abres el panel). */
export function NotificationsMenu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

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
        className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-border"
      >
        <IconBell className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-80 animate-menu-in overflow-hidden rounded-3xl border border-white/10 bg-neutral-900 text-white shadow-2xl">
          <p className="px-5 pt-5 font-semibold">Notificaciones</p>
          <div className="flex flex-col items-center gap-1 px-8 py-10 text-center">
            <p className="font-semibold">Todavía no hay nada aquí</p>
            <p className="text-sm text-white/50">Te avisaremos cuando pase algo importante con tus pedidos.</p>
          </div>
        </div>
      )}
    </div>
  )
}
