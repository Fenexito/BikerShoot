import { IconSearch } from '../shared/icons'
import { cn } from '../../lib/cn'

export interface StudioFilterOption {
  value: string
  label: string
}

interface StudioFilterBarProps {
  /** Switch de 2 estados a la izquierda (estilo iOS/Web de la referencia) —
   * un vistazo rápido entre los dos estados más comunes. No es un filtro
   * "excluyente" en el sentido de ocultar todo lo demás para siempre: cada
   * página decide qué significa seleccionarlo (filtrar, o solo saltar a esa
   * sección). Si no se da, no se muestra ni el switch ni su separador. */
  segments?: StudioFilterOption[]
  segmentValue?: string | null
  onSegmentChange?: (value: string) => void
  /** Pestañas de texto subrayado (estilo Mobbin) — para el resto de
   * opciones que no caben en el switch de 2 estados. */
  tabs?: StudioFilterOption[]
  tabValue?: string | null
  onTabChange?: (value: string) => void
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  className?: string
}

/** Barra de búsqueda + filtros reutilizable — una sola línea, justo debajo
 * del título de la página y antes de cualquier tarjeta/lista. Mismo
 * componente en Eventos, Pedidos, Fotógrafos, etc. Orden de izquierda a
 * derecha (inspirado en la referencia de Mobbin): switch de 2 estados →
 * separador → pestañas de texto subrayado → buscador pegado al borde
 * derecho. */
export function StudioFilterBar({
  segments,
  segmentValue,
  onSegmentChange,
  tabs,
  tabValue,
  onTabChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Buscar',
  className,
}: StudioFilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-4 border-b border-border pb-4', className)}>
      {segments && segments.length > 0 && (
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-muted p-1">
          {segments.map((s) => (
            <button
              key={s.value}
              onClick={() => onSegmentChange?.(s.value)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                segmentValue === s.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {segments && segments.length > 0 && tabs && tabs.length > 0 && <div className="h-6 w-px shrink-0 bg-border" />}

      {tabs && tabs.length > 0 && (
        <nav className="flex flex-1 flex-wrap items-center gap-5 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => onTabChange?.(t.value)}
              className={cn(
                'whitespace-nowrap border-b-2 pb-0.5 text-sm font-medium transition-colors',
                tabValue === t.value ? 'border-foreground font-bold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      )}

      {/* Buscador — siempre al borde derecho por completo, nunca empujado
          por los tabs (que ya reclaman el espacio flexible disponible). */}
      <div className="ml-auto flex w-full shrink-0 items-center gap-2 rounded-full bg-muted px-4 py-2 sm:w-auto sm:min-w-[220px]">
        <IconSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  )
}
