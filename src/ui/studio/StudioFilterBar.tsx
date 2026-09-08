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

/** Barra de búsqueda + filtros reutilizable — justo debajo del título de la
 * página y antes de cualquier tarjeta/lista. Mismo componente en Eventos,
 * Pedidos, Fotógrafos, etc. Orden de izquierda a derecha (inspirado en la
 * referencia de Mobbin): switch de 2 estados → separador → pestañas de
 * texto subrayado → buscador.
 * En móvil, el switch+separador+pestañas viven en su PROPIA fila que
 * scrollea horizontalmente en vez de envolver línea por línea — con
 * varias opciones (ej. Pedidos: 2 segmentos + 3 pestañas) envolver
 * (flex-wrap) partía el grupo en un orden confuso; un scroll horizontal se
 * ve igual de prolijo sin importar cuántas opciones tenga cada página. El
 * buscador baja a su propia fila completa en móvil, y solo se junta a la
 * derecha de esa fila desde `sm:` en adelante donde ya cabe cómodo. */
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
    <div className={cn('flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center', className)}>
      <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto">
        {segments && segments.length > 0 && (
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-muted p-1">
            {segments.map((s) => (
              <button
                key={s.value}
                onClick={() => onSegmentChange?.(s.value)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
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
          <nav className="flex shrink-0 items-center gap-5">
            {tabs.map((t) => (
              <button
                key={t.value}
                onClick={() => onTabChange?.(t.value)}
                className={cn(
                  'shrink-0 whitespace-nowrap border-b-2 pb-0.5 text-sm font-medium transition-colors',
                  tabValue === t.value ? 'border-foreground font-bold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Buscador — propia fila completa en móvil, pegado al borde derecho
          desde `sm:` en adelante. */}
      <div className="flex w-full shrink-0 items-center gap-2 rounded-full bg-muted px-4 py-2 sm:w-auto sm:min-w-[220px]">
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
