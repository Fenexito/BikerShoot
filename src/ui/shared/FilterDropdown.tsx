import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { IconChevronDown } from './icons'

export interface FilterDropdownOption {
  value: string
  label: string
}

interface FilterDropdownProps {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  options: FilterDropdownOption[]
  className?: string
  /** `pill` (por defecto): pastilla con borde, pensada para la barra de
   * filtros de la página. `text` — solo el texto, con un resaltado si tiene
   * algo elegido y un contador entre paréntesis — pensada para vivir dentro
   * del header interactivo, al lado del resto de títulos/links del sitio,
   * donde una pastilla redonda se veía fuera de lugar. */
  variant?: 'pill' | 'text'
}

/** Filtro multi-selectivo pensado para vivir EN LÍNEA — dentro de una barra
 * de filtros (en la página, o dentro del header interactivo transformado),
 * no dentro de un modal oscuro. Aplica cada cambio al instante (no hay
 * "borrador" ni botón Aplicar): al vivir siempre visible en vez de detrás de
 * un modal que hay que abrir a propósito, cada click refiltrando de
 * inmediato se siente igual de normal que cualquier otra barra de filtros
 * de e-commerce.
 *
 * Sin opciones disponibles Y sin nada ya seleccionado: se deshabilita sola
 * (no tiene sentido abrir un panel vacío) — pero si ya había algo elegido
 * y un cambio en OTRO filtro dejó esta lista en cero, se mantiene
 * habilitada para poder quitar esa selección que ya no aplica. */
export function FilterDropdown({ label, values, onChange, options, className, variant = 'pill' }: FilterDropdownProps) {
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

  function toggle(value: string) {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value])
  }

  const disabled = options.length === 0 && values.length === 0

  return (
    <div ref={rootRef} className={cn('relative shrink-0', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={
          variant === 'text'
            ? cn(
                'flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1 text-sm font-medium transition-colors',
                values.length > 0 ? 'font-semibold text-primary' : 'text-muted-foreground hover:text-foreground',
                disabled && 'cursor-not-allowed opacity-40',
              )
            : cn(
                'flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors',
                values.length > 0 ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-foreground hover:bg-muted',
                disabled && 'cursor-not-allowed opacity-40',
              )
        }
      >
        <span className={cn(variant === 'pill' && 'max-w-[9rem] truncate')}>
          {label}
          {values.length > 0 && ` (${values.length})`}
        </span>
        <IconChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && !disabled && (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-64 w-56 origin-top animate-menu-in overflow-y-auto rounded-2xl border border-border bg-background py-1.5 shadow-2xl">
          {options.length === 0 && <p className="px-4 py-2 text-sm text-muted-foreground">Sin opciones para esta combinación</p>}
          {options.map((o) => {
            const checked = values.includes(o.value)
            return (
              <button
                type="button"
                key={o.value}
                onClick={() => toggle(o.value)}
                className="flex w-full items-center gap-2.5 truncate px-4 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                    checked ? 'border-primary bg-primary text-white' : 'border-border',
                  )}
                >
                  {checked && '✓'}
                </span>
                <span className="truncate">{o.label}</span>
              </button>
            )
          })}
          {values.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 block w-full truncate border-t border-border px-4 py-2 text-left text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Limpiar
            </button>
          )}
        </div>
      )}
    </div>
  )
}
