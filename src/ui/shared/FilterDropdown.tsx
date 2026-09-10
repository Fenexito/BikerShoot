import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'
import { getPortalRoot } from './portalRoot'
import { IconChevronDown, IconClose } from './icons'

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

const PANEL_WIDTH = 224

/** Filtro multi-selectivo pensado para vivir EN LÍNEA — dentro de una barra
 * de filtros (en la página, o dentro del header interactivo transformado),
 * no dentro de un modal oscuro. Aplica cada cambio al instante.
 *
 * El panel se renderiza en un portal con posición `fixed` calculada desde el
 * botón (en vez de `absolute` relativo a este contenedor) — la barra que lo
 * aloja necesita poder scrollear horizontalmente en móvil (donde no caben
 * los ~6 controles en una sola fila), y `overflow-x-auto` en el contenedor
 * recortaría también el panel en el eje vertical si viviera adentro. */
export function FilterDropdown({ label, values, onChange, options, className, variant = 'pill' }: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const left = Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8)
    setCoords({ top: rect.bottom + 8, left: Math.max(8, left) })
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    // El scroll (de la página, o del propio contenedor horizontal de
    // filtros) cierra el panel en vez de re-posicionarlo — más simple y
    // predecible que perseguir al botón con un listener de scroll continuo.
    function onScroll() {
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  function toggle(value: string) {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value])
  }

  const disabled = options.length === 0 && values.length === 0

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'shrink-0',
          variant === 'text'
            ? cn(
                'flex items-center gap-1 whitespace-nowrap rounded-full px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
                values.length > 0 && 'font-semibold !text-primary',
                disabled && 'cursor-not-allowed opacity-40',
              )
            : cn(
                'flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors',
                values.length > 0 ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-foreground hover:bg-muted',
                disabled && 'cursor-not-allowed opacity-40',
              ),
          className,
        )}
      >
        <span className={cn(variant === 'pill' && 'max-w-[9rem] truncate')}>
          {label}
          {values.length > 0 && ` (${values.length})`}
        </span>
        <IconChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open &&
        !disabled &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', top: coords.top, left: coords.left, width: PANEL_WIDTH }}
            className="z-50 max-h-64 origin-top animate-menu-in overflow-y-auto rounded-2xl border border-border bg-background py-1.5 shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
              {values.length > 0 && (
                <button type="button" onClick={() => onChange([])} aria-label="Limpiar" className="text-red-500 hover:text-red-600">
                  <IconClose className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
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
          </div>,
          getPortalRoot(),
        )}
    </>
  )
}
