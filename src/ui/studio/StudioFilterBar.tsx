import { IconSearch, IconFilter } from '../shared/icons'
import { cn } from '../../lib/cn'

export interface StudioFilterTab {
  value: string
  label: string
  count?: number
}

interface StudioFilterBarProps {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  tabs?: StudioFilterTab[]
  tabValue?: string
  onTabChange?: (value: string) => void
  onFilterClick?: () => void
  filterCount?: number
  className?: string
}

/** Barra de búsqueda + filtros reutilizable — una sola línea, justo debajo
 * del título de la página y antes de cualquier tarjeta/lista. Mismo
 * componente en Eventos, Pedidos, Fotógrafos, etc. para que filtrar se
 * sienta idéntico en toda la app en vez de que cada página invente su
 * propia fila. Los tabs usan subrayado en vez de pills (inspirado en las
 * pestañas de texto de Mobbin) — el buscador y "Filtros" sí conservan el
 * lenguaje redondeado del resto de Studio. */
export function StudioFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Buscar…',
  tabs,
  tabValue,
  onTabChange,
  onFilterClick,
  filterCount = 0,
  className,
}: StudioFilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border pb-4', className)}>
      <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-full bg-muted px-4 py-2 sm:max-w-xs">
        <IconSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

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
              {t.count != null && <span className="ml-1 opacity-60">({t.count})</span>}
            </button>
          ))}
        </nav>
      )}

      {onFilterClick && (
        <button
          onClick={onFilterClick}
          className="ml-auto flex shrink-0 items-center gap-2 text-sm font-semibold text-foreground transition-colors hover:text-muted-foreground"
        >
          <IconFilter className="h-4 w-4" />
          Filtros
          {filterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">{filterCount}</span>
          )}
        </button>
      )}
    </div>
  )
}
