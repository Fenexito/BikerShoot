import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import type { DarkSelectOption } from './DarkSelectField'

interface DarkMultiSelectFieldProps {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  options: DarkSelectOption[]
  placeholder?: string
  /** Deshabilitado cuando no aplica dado el resto de filtros elegidos (ej.
   * "Ruta" cuando la categoría elegida excluye Rodada) — se ve atenuado y no
   * abre el panel, en vez de desaparecer del todo (mantiene el layout
   * estable mientras el usuario cambia de categoría). */
  disabled?: boolean
  disabledHint?: string
}

/** Versión multi-selección de `DarkSelectField` — mismo panel flotante
 * oscuro, pero cada opción es un checkbox y el panel no se cierra al
 * elegir, para poder marcar varias seguidas. Todos los filtros de
 * `SearchFilterModal` son multi-selectivos (item 6 del pedido del biker):
 * un usuario puede querer "todas las fotos de la ruta X" o "solo del
 * fotógrafo Y", sin tener que elegir una sola opción a la vez. */
export function DarkMultiSelectField({ label, values, onChange, options, placeholder = 'Todas', disabled, disabledHint }: DarkMultiSelectFieldProps) {
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

  const summary =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? options.find((o) => o.value === values[0])?.label ?? placeholder
        : `${values.length} seleccionados`

  return (
    <div ref={rootRef} className="relative flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/50">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        title={disabled ? disabledHint : undefined}
        className={cn(
          'flex h-12 items-center justify-between gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-left text-sm text-white outline-none transition-colors focus:border-white/30',
          disabled && 'cursor-not-allowed opacity-40',
        )}
      >
        <span className={cn('truncate', values.length === 0 && 'text-white/50')}>{summary}</span>
        <span className={cn('shrink-0 text-[10px] text-white/50 transition-transform', open && 'rotate-180')}>▾</span>
      </button>
      {open && !disabled && (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-60 w-full min-w-[10rem] origin-top animate-menu-in overflow-y-auto rounded-2xl border border-white/10 bg-neutral-800 py-1.5 shadow-2xl">
          {options.length === 0 && <p className="px-4 py-2 text-sm text-white/40">Sin opciones disponibles</p>}
          {options.map((o) => {
            const checked = values.includes(o.value)
            return (
              <button
                type="button"
                key={o.value}
                onClick={() => toggle(o.value)}
                className="flex w-full items-center gap-2.5 truncate px-4 py-2 text-left text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                    checked ? 'border-white bg-white text-black' : 'border-white/30',
                  )}
                >
                  {checked && '✓'}
                </span>
                <span className={cn('truncate', checked && 'text-white')}>{o.label}</span>
              </button>
            )
          })}
          {values.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 block w-full truncate border-t border-white/10 px-4 py-2 text-left text-xs font-semibold text-white/50 hover:text-white"
            >
              Limpiar
            </button>
          )}
        </div>
      )}
    </div>
  )
}
