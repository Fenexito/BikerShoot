import { IconSearch } from './icons'
import { cn } from '../../lib/cn'

export interface FilterOption {
  value: string
  label: string
}

interface FilterBarProps {
  /** Pastilla de 2 estados (estilo iOS/Web de Mobbin) — opcional. Antes se
   * había quitado de este componente porque en Pedidos/Eventos de Studio
   * no había una división real de "dos categorías principales, cada una
   * con su propio set de sub-filtros"; en Eventos del biker SÍ la hay
   * (Rodada -> filtra por ruta, Evento -> filtra por tipo), así que
   * regresó — pero es opcional, cada página decide si la necesita. Cuando
   * el segmento cambia, la página normalmente también cambia qué opciones
   * pasa en `tabs` (las tabs "pertenecen" al segmento activo). */
  segments?: FilterOption[]
  segmentValue?: string | null
  onSegmentChange?: (value: string) => void
  /** Pestañas de texto subrayado (mismo lenguaje visual que Configuración
   * y el editor de evento). Si hay `segments`, estas tabs son las
   * sub-opciones del segmento activo (la página las recalcula al cambiar
   * de segmento); si no hay `segments`, son la única fila de filtros. */
  tabs: FilterOption[]
  tabValue?: string | null
  onTabChange: (value: string) => void
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  /** Oculta el buscador propio de la barra — útil cuando este FilterBar se
   * reutiliza junto a OTRO buscador ya visible al lado (ej. el disparador
   * de búsqueda global del header transformado), para no duplicar el
   * campo ni competir por el mismo espacio angosto. */
  hideSearch?: boolean
  className?: string
}

/** Barra de búsqueda + filtros reutilizable — justo debajo del título de la
 * página y antes de cualquier tarjeta/lista. Portal-agnóstica a propósito
 * (vivía en `ui/studio/` como `StudioFilterBar`, movida a `ui/shared/`
 * cuando el biker también la necesitó): no usa ningún color de acento
 * fijo, solo tokens semánticos (`border-foreground`, `bg-muted`, etc.) que
 * ya cambian solos según el tema del portal activo.
 * En móvil, las pestañas (mismo estilo subrayado de siempre, nunca se
 * vuelven chips/píldoras) se DISTRIBUYEN a todo el ancho disponible
 * (`justify-between`, cada una a su ancho natural según su texto — nunca
 * se trunca) en vez de quedar apretadas a la izquierda con un hueco vacío
 * a la derecha — desde `sm:` en adelante (donde ya suele sobrar espacio)
 * vuelven al ancho automático alineado a la izquierda de la vista de
 * escritorio. El buscador baja a su propia fila completa en móvil, y solo
 * se junta a la derecha de esa fila desde `sm:` en adelante donde ya cabe
 * cómodo. */
export function FilterBar({
  segments,
  segmentValue,
  onSegmentChange,
  tabs,
  tabValue,
  onTabChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Buscar',
  hideSearch = false,
  className,
}: FilterBarProps) {
  return (
    <div className={cn('flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center', className)}>
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4 sm:overflow-x-auto">
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

        {segments && segments.length > 0 && tabs.length > 0 && <div className="h-6 w-px shrink-0 bg-border" />}

        {/* Distribuidas a todo el ancho en móvil (`justify-between`: el
            espacio libre se reparte ENTRE las pestañas, cada una a su
            ancho natural — nunca se achican por debajo de su propio
            texto, así nunca se corta) — desde `sm:` en adelante vuelven al
            ancho automático alineado a la izquierda de siempre. */}
        {tabs.length > 0 && (
          // `overflow-x-auto` es solo una red de seguridad: si algún día el
          // set de tabs no cabe ni siquiera a su ancho mínimo (textos muy
          // largos, o una pantalla MUY angosta), se puede desplazar en vez
          // de cortarse o desbordar la página — con las 5-6 tabs actuales
          // de Pedidos/Eventos, en la práctica el ancho siempre alcanza y
          // `justify-between` es quien realmente se ve.
          <nav className="flex flex-1 items-center justify-between gap-2 overflow-x-auto sm:flex-none sm:shrink-0 sm:justify-start sm:gap-5">
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
        )}
      </div>

      {/* Buscador — propia fila completa en móvil, pegado al borde derecho
          desde `sm:` en adelante. */}
      {!hideSearch && (
        <div className="flex w-full shrink-0 items-center gap-2 rounded-full bg-muted px-4 py-2 sm:w-auto sm:min-w-[220px]">
          <IconSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      )}
    </div>
  )
}
