import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

export interface DarkSelectOption {
  value: string
  label: string
}

interface DarkSelectFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  options: DarkSelectOption[]
  placeholder?: string
}

/** Campo de selección con panel flotante oscuro — pensado para vivir
 * DENTRO de un modal ya oscuro (`bg-neutral-900`), donde el `<select>`
 * nativo gris o incluso `FancySelect` (claro) desentonarían. Antes vivía
 * solo dentro de `SearchFilterModal.tsx`; se movió aquí para que
 * cualquier otro modal de filtros oscuro (ej. `EventsFilterModal.tsx`)
 * lo reutilice en vez de copiarlo. */
export function DarkSelectField({ label, value, onChange, options, placeholder = 'Todas' }: DarkSelectFieldProps) {
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

  const current = options.find((o) => o.value === value)

  return (
    <div ref={rootRef} className="relative flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/50">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 items-center justify-between gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-left text-sm text-white outline-none transition-colors focus:border-white/30"
      >
        <span className={cn('truncate', !current && 'text-white/50')}>{current?.label ?? placeholder}</span>
        <span className={cn('shrink-0 text-[10px] text-white/50 transition-transform', open && 'rotate-180')}>▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-60 w-full min-w-[10rem] origin-top animate-menu-in overflow-y-auto rounded-2xl border border-white/10 bg-neutral-800 py-1.5 shadow-2xl">
          <button
            type="button"
            onClick={() => { setOpen(false); onChange('') }}
            className={cn('block w-full truncate px-4 py-2 text-left text-sm font-medium transition-colors hover:bg-white/10', !value ? 'text-white' : 'text-white/70')}
          >
            {placeholder}
          </button>
          {options.map((o) => (
            <button
              type="button"
              key={o.value}
              onClick={() => { setOpen(false); onChange(o.value) }}
              className={cn('block w-full truncate px-4 py-2 text-left text-sm font-medium transition-colors hover:bg-white/10', value === o.value ? 'text-white' : 'text-white/70')}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
