import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'
import { getPortalRoot } from './portalRoot'

interface MobileMenuOverlayProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}

/** Overlay de menú móvil compartido entre los 3 headers (Studio/biker/público) —
 * cada uno le pasa su propio contenido con su propio sistema de diseño; esto
 * solo resuelve el portal, el fondo, el bloqueo de scroll y cerrar con Escape. */
export function MobileMenuOverlay({ open, onClose, children, className }: MobileMenuOverlayProps) {
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] md:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cn('absolute inset-x-0 top-0 flex max-h-full flex-col overflow-y-auto', className)}>
        {children}
      </div>
    </div>,
    getPortalRoot(),
  )
}
