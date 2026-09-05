import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconMoreHorizontal } from './icons'
import { cn } from '../../lib/cn'

export interface ActionMenuItem {
  to?: string
  onClick?: () => void
  label: string
  icon?: ReactNode
  tone?: 'default' | 'danger'
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  triggerClassName?: string
  align?: 'left' | 'right'
}

/** Botón "···" con panel flotante oscuro — mismo lenguaje visual que
 * ProfileMenu, para agrupar acciones secundarias (editar/eliminar) detrás
 * de un solo control en vez de varios botones sueltos compitiendo visualmente
 * con la acción principal de la tarjeta/página. */
export function ActionMenu({ items, triggerClassName, align = 'right' }: ActionMenuProps) {
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
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        aria-label="Más opciones"
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted',
          triggerClassName,
        )}
      >
        <IconMoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div
          className={cn(
            'absolute top-full z-50 mt-2 w-48 origin-top overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 py-1.5 text-white shadow-2xl animate-menu-in',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => {
            const content = (
              <>
                {item.icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center">{item.icon}</span>}
                <span className="truncate">{item.label}</span>
              </>
            )
            const itemClass = cn(
              'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/10',
              item.tone === 'danger' ? 'text-red-400' : 'text-white/90',
            )
            return item.to ? (
              <Link key={item.label} to={item.to} onClick={() => setOpen(false)} className={itemClass}>
                {content}
              </Link>
            ) : (
              <button
                key={item.label}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setOpen(false)
                  item.onClick?.()
                }}
                className={itemClass}
              >
                {content}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
