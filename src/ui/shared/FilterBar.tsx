import { IconSearch } from './icons'
import { cn } from '../../lib/cn'

export interface FilterOption {
  value: string
  label: string
}

interface FilterBarProps {
  /** Pestañas de texto subrayado (mismo lenguaje visual que Configuración
   * y el editor de evento) — TODAS las opciones de filtro viven aquí, en
   * una sola fila. Antes había un switch de 2 estados aparte para las 2
   * opciones "principales" (estilo Mobbin), pero esa referencia asume dos
   * categorías con su propio espacio para sub-filtros — algo que esta app
   * no tiene. Con todo mezclado en un switch + tabs por separado, Pedidos
   * y Eventos se sentían inconsistentes entre sí. Ahora cada página pasa
   * UNA sola lista con todas sus opciones (ej. Todos/Activos/Pausados/
   * Cerrados), sin distinción de cuáles son "principales". */
  tabs: FilterOption[]
  tabValue?: string | null
  onTabChange: (value: string) => void
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  className?: string
}

/** Barra de búsqueda + filtros reutilizable — justo debajo del título de la
 * página y antes de cualquier tarjeta/lista. Portal-agnóstica a propósito
 * (vivía en `ui/studio/` como `StudioFilterBar`, movida a `ui/shared/`
 * cuando el biker también la necesitó — Eventos/Pedidos en Studio,
 * Eventos/Fotógrafos en biker): no usa ningún color de acento fijo, solo
 * tokens semánticos (`border-foreground`, `bg-muted`, etc.) que ya cambian
 * solos según el tema del portal activo.
 * En móvil, las pestañas viven en su PROPIA fila que scrollea
 * horizontalmente (igual que la pestaña de Configuración en angosto) en
 * vez de envolver línea por línea. El buscador baja a su propia fila
 * completa en móvil, y solo se junta a la derecha de esa fila desde `sm:`
 * en adelante donde ya cabe cómodo. */
export function FilterBar({
  tabs,
  tabValue,
  onTabChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Buscar',
  className,
}: FilterBarProps) {
  return (
    <div className={cn('flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center', className)}>
      <nav className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto sm:gap-5">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => onTabChange(t.value)}
            className={cn(
              'shrink-0 whitespace-nowrap border-b-2 pb-0.5 text-xs font-medium transition-colors sm:text-sm',
              tabValue === t.value ? 'border-foreground font-bold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

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
