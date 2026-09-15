import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

const ICON = {
  viewBox: '0 0 24 24',
  fill: 'none',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export interface ConfirmDeleteButtonProps {
  /** Se llama solo tras confirmar — nunca al primer clic. */
  onConfirm: () => void
  /** Contenido EXACTO del botón disparador (ícono, ícono+texto, lo que ya
   * tuviera cada lugar) — se conserva tal cual, nada de esto cambia. */
  children: ReactNode
  /** Clases del botón disparador — las mismas que ya usaba cada sitio (ni el
   * ícono ni la forma cambian, solo lo que pasa al hacer clic). */
  triggerClassName: string
  label?: string
  containerClassName?: string
  panelClassName?: string
}

/** Reemplaza el modal de "¿Eliminar esta foto?" por una confirmación en
 * línea, justo al lado del botón que ya existía — mismo ícono/forma que
 * cada caller ya tenía (`children`/`triggerClassName` sin tocar), pero en
 * vez de disparar la eliminación (o abrir un modal aparte) al primer clic,
 * despliega un mini panel con dos círculos (✓ confirma, ✕ cancela) pegado
 * al propio botón — inspirado en el patrón "DeleteButton" de animate-ui,
 * adaptado para conservar el trigger propio de cada lugar en vez del ícono
 * de basurero genérico del original.
 *
 * El panel se queda SIEMPRE montado en el DOM (visibilidad por clases de
 * Tailwind, no por `AnimatePresence`/mount-unmount) — este botón vive
 * dentro de widgets ya muy animados (ej. `AccordionGallery`, con su propio
 * `motion`/GSAP reacomodando el DOM en cada hover); dejar que un
 * `AnimatePresence` propio maneje su des-montaje ahí adentro se probó y a
 * veces el panel se quedaba pegado en pantalla para siempre (el padre
 * interrumpía la animación de salida antes de que terminara). Clases +
 * transición CSS normal no dependen de ningún ciclo de vida ajeno. */
export function ConfirmDeleteButton({
  onConfirm,
  children,
  triggerClassName,
  label = 'Eliminar',
  containerClassName,
  panelClassName,
}: ConfirmDeleteButtonProps) {
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
    <div ref={rootRef} className={cn('relative z-10 flex items-center gap-1.5', containerClassName)}>
      <div
        aria-hidden={!open}
        className={cn(
          'flex items-center gap-1 rounded-full bg-neutral-900 p-1 shadow-lg transition-all duration-200 ease-out',
          open ? 'scale-100 opacity-100' : 'pointer-events-none w-0 scale-90 gap-0 overflow-hidden p-0 opacity-0',
          panelClassName,
        )}
      >
        <button
          type="button"
          aria-label="Confirmar eliminación"
          tabIndex={open ? 0 : -1}
          onClick={(e) => {
            e.stopPropagation()
            setOpen(false)
            onConfirm()
          }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-400"
        >
          <svg {...ICON} width="12" height="12" stroke="currentColor" strokeWidth="3.5">
            <path d="M4 12.5 9.5 18 20 7" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Cancelar"
          tabIndex={open ? 0 : -1}
          onClick={(e) => {
            e.stopPropagation()
            setOpen(false)
          }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <svg {...ICON} width="12" height="12" stroke="currentColor" strokeWidth="3.5">
            <path d="M6 6 18 18M18 6 6 18" />
          </svg>
        </button>
      </div>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className={cn(triggerClassName, open && 'opacity-100')}
      >
        {children}
      </button>
    </div>
  )
}
