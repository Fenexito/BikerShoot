import * as HoverCardPrimitive from '@radix-ui/react-hover-card'
import { AnimatePresence, motion } from 'motion/react'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

const PreviewLinkCardOpenContext = createContext(false)

// Listo para usarse, pero todavía sin aplicarse a ningún link real de la
// app (se pidió explícitamente dejarlo construido para decidir después
// dónde va) — sobre Radix HoverCard (accesible: abre con hover Y con foco
// de teclado, no solo con mouse) en vez de un simple `onMouseEnter` a
// mano, con la aparición animada por `motion` en vez de un fade plano.
// Mismo patrón que `Tooltip.tsx`: el estado de abierto/cerrado se controla
// aquí (no con `forceMount` suelto) para que `AnimatePresence` sepa
// exactamente cuándo desmontar el contenido tras su animación de salida.

export function PreviewLinkCard({ children, openDelay, closeDelay }: { children: ReactNode; openDelay?: number; closeDelay?: number }) {
  const [open, setOpen] = useState(false)
  return (
    <HoverCardPrimitive.Root open={open} onOpenChange={setOpen} openDelay={openDelay} closeDelay={closeDelay}>
      <PreviewLinkCardOpenContext.Provider value={open}>{children}</PreviewLinkCardOpenContext.Provider>
    </HoverCardPrimitive.Root>
  )
}

export interface PreviewLinkCardTriggerProps {
  href: string
  children: ReactNode
  className?: string
  target?: string
  rel?: string
}

/** El link real y clickeable — el preview es un extra, no reemplaza la
 * navegación normal. */
export function PreviewLinkCardTrigger({ href, children, className, target, rel }: PreviewLinkCardTriggerProps) {
  return (
    <HoverCardPrimitive.Trigger asChild>
      <a href={href} target={target} rel={rel} className={className}>
        {children}
      </a>
    </HoverCardPrimitive.Trigger>
  )
}

export interface PreviewLinkCardContentProps {
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
  align?: 'start' | 'center' | 'end'
  alignOffset?: number
  className?: string
}

export function PreviewLinkCardContent({
  children,
  side = 'bottom',
  sideOffset = 8,
  align = 'center',
  alignOffset,
  className,
}: PreviewLinkCardContentProps) {
  const open = useContext(PreviewLinkCardOpenContext)
  return (
    <HoverCardPrimitive.Portal forceMount>
      <AnimatePresence>
        {open && (
          <HoverCardPrimitive.Content
            asChild
            side={side}
            sideOffset={sideOffset}
            align={align}
            alignOffset={alignOffset}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: side === 'top' ? 4 : -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={cn(
                'z-50 w-72 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 text-white shadow-2xl',
                className,
              )}
            >
              {children}
            </motion.div>
          </HoverCardPrimitive.Content>
        )}
      </AnimatePresence>
    </HoverCardPrimitive.Portal>
  )
}

/** Imagen del preview — 16:9 por defecto, con un estado de "cargando" simple
 * mientras la imagen real resuelve (evita el salto brusco de layout). */
export function PreviewLinkCardImage({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className={cn('relative aspect-video w-full bg-white/5', className)}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-white/5" />}
      {src && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          className={cn('h-full w-full object-cover transition-opacity duration-200', loaded ? 'opacity-100' : 'opacity-0')}
        />
      )}
    </div>
  )
}
