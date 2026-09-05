import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

export interface FancySelectOption {
  value: string
  label: string
}

interface FancySelectProps {
  value: string
  onChange: (value: string) => void
  options: FancySelectOption[]
  placeholder?: string
  label?: string
  className?: string
  /** false para campos obligatorios (categoría, estado) donde no tiene
   * sentido un botón "quitar" que deje el valor vacío. Default true. */
  clearable?: boolean
}

/** Reemplazo del <select> nativo — mismo panel oscuro y flotante que
 * ProfileMenu/Dropdown, para que ninguna lista de la app use el control
 * gris por defecto del navegador. Drop-in casi directo de ui/flat/Select
 * y ui/studio/Select: misma forma (rounded-full, h-12), pero controlado
 * por value/onChange(value) en vez de un evento de <select> nativo. */
export function FancySelect({ value, onChange, options, placeholder = 'Todos', label, className, clearable = true }: FancySelectProps) {
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

  const current = options.find((o) => o.value === value)

  return (
    <div ref={rootRef} className={cn('relative flex flex-col gap-1.5', className)}>
      {label && <span className="text-sm font-medium text-foreground">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-12 w-full items-center justify-between gap-2 rounded-full border-2 border-transparent bg-muted px-4 text-left text-sm text-foreground outline-none transition-colors duration-200',
          open ? 'border-primary bg-background' : 'hover:bg-border/60',
        )}
      >
        <span className={cn('truncate', !current && 'text-muted-foreground')}>{current?.label ?? placeholder}</span>
        <span className={cn('shrink-0 text-[10px] text-muted-foreground transition-transform', open && 'rotate-180')}>▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-72 w-full min-w-[10rem] origin-top animate-menu-in overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900 py-1.5 text-white shadow-2xl">
          {clearable && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onChange('')
              }}
              className={cn('block w-full truncate px-4 py-2 text-left text-sm font-medium transition-colors hover:bg-white/10', !value ? 'text-white' : 'text-white/70')}
            >
              {placeholder}
            </button>
          )}
          {options.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => {
                setOpen(false)
                onChange(opt.value)
              }}
              className={cn(
                'block w-full truncate px-4 py-2 text-left text-sm font-medium transition-colors hover:bg-white/10',
                value === opt.value ? 'text-white' : 'text-white/70',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
