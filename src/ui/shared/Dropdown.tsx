import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

export interface DropdownOption {
  value: string
  label: string
}

interface DropdownProps {
  label: string
  options: DropdownOption[]
  onSelect: (value: string) => void
  className?: string
}

/** Menú desplegable oscuro y flotante, mismo lenguaje visual que ProfileMenu/
 * NotificationsMenu — reemplaza un <select> nativo cuando queremos que la
 * lista luzca como el resto de la app en vez del control gris del navegador. */
export function Dropdown({ label, options, onSelect, className }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-muted"
      >
        {label}
        <span className={cn('text-[10px] transition-transform', open && 'rotate-180')}>▾</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-52 origin-bottom animate-menu-in overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 py-1.5 text-white shadow-2xl">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setOpen(false)
                onSelect(opt.value)
              }}
              className="block w-full truncate px-4 py-2 text-left text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
