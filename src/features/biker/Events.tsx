import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePublicEvents, useApprovedPhotographers, useFeaturedEventPhotos } from './usePublicData'
import { useRoutes } from '../shared/useRoutes'
import { EventCard } from './components/EventCard'
import { EventsFilterModal } from './components/EventsFilterModal'
import { FilterBar, type FilterOption } from '../../ui/shared/FilterBar'
import { SkeletonGrid } from '../../ui/shared/Skeleton'
import { useHeaderTransform } from '../../ui/layout/useHeaderTransform'
import { useScrolledPast } from '../../ui/shared/useScrolledPast'
import { IconFilter } from '../../ui/shared/icons'
import { cn } from '../../lib/cn'
import type { DbPhoto } from '../../types/db'
import type { PublicEvent } from './usePublicData'

type EventGroup = 'rodada' | 'evento' | ''

// Las tabs de la fila cambian según qué pastilla (Rodada/Evento) está
// activa — Rodada filtra por ruta específica, Evento por tipo (Autódromo/
// Sesión de fotos). Mismo patrón de dos niveles que Mobbin usa para
// categorías con sub-filtros propios (a diferencia de Pedidos/Eventos de
// Studio, aquí SÍ hay dos categorías realmente distintas entre sí).
const EVENT_TYPE_TABS: FilterOption[] = [
  { value: '', label: 'Todos' },
  { value: 'Pista', label: 'Autódromo' },
  { value: 'Sesión de Fotos', label: 'Sesión de fotos' },
]

function monthKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(iso: string) {
  const label = new Date(iso).toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Un mes de eventos — colapsable, mismo espíritu que las categorías de
 * estado en Pedidos de Studio (ahí por estado; aquí por mes, ya que un
 * biker navegando eventos quiere ver los recientes/próximos de un
 * vistazo y poder ocultar los ya pasados sin perder acceso a ellos). */
function MonthSection({ label, events, photosByEvent, defaultOpen }: {
  label: string
  events: PublicEvent[]
  photosByEvent: Map<string, DbPhoto[]>
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="mb-4 flex w-full items-center justify-between gap-2 text-left">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {label}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{events.length}</span>
        </h2>
        <span className={cn('text-xs text-muted-foreground transition-transform', open && 'rotate-180')}>▾</span>
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event, i) => (
            <div key={event.id} className="animate-[fade-in-up_.4s_ease-out_backwards]" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <EventCard event={event} photos={photosByEvent.get(event.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Con 100+ eventos previstos, filtrar solo con selects sueltos no
 * alcanza — la barra de filtros vive en el header interactivo una vez que
 * el usuario hace scroll más allá de la intro, para que siga alcanzable
 * sin tener que volver arriba. */
export function Events() {
  const { data: events = [], isLoading } = usePublicEvents()
  const { data: photographers = [] } = useApprovedPhotographers()
  const { data: routes = [] } = useRoutes()
  const { data: featuredPhotos = [] } = useFeaturedEventPhotos()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Sin valor por defecto a propósito — la pastilla arranca sin selección
  // (ver el estado del botón en FilterBar) y solo cambia entre Rodada/
  // Evento desde que el usuario elige una vez; no hay forma de volver al
  // estado "sin selección" salvo recargar la página.
  const group = (searchParams.get('tipo') as EventGroup | null) ?? ''
  const city = searchParams.get('ciudad') ?? ''
  const category = searchParams.get('categoria') ?? ''
  const routeId = searchParams.get('ruta') ?? ''
  const photographerId = searchParams.get('fotografo') ?? ''
  const sort = searchParams.get('orden') ?? 'recientes'
  const scrolledPast = useScrolledPast(160)

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  function setGroup(next: string) {
    const params = new URLSearchParams(searchParams)
    params.set('tipo', next)
    params.delete('ruta')
    params.delete('categoria')
    setSearchParams(params, { replace: true })
  }

  const CITIES = useMemo(() => Array.from(new Set(events.map((e) => e.city))), [events])
  const ROUTE_TABS: FilterOption[] = useMemo(
    () => [{ value: '', label: 'Todas las rutas' }, ...routes.map((r) => ({ value: r.id, label: r.name }))],
    [routes],
  )

  const photosByEvent = useMemo(() => {
    const map = new Map<string, DbPhoto[]>()
    for (const p of featuredPhotos) {
      const list = map.get(p.event_id) ?? []
      list.push(p)
      map.set(p.event_id, list)
    }
    return map
  }, [featuredPhotos])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...events]
      .filter((e) => (group === 'rodada' ? e.category === 'Rodada' : group === 'evento' ? e.category !== 'Rodada' : true))
      .filter((e) => (city ? e.city === city : true))
      .filter((e) => (group === 'evento' && category ? e.category === category : true))
      .filter((e) => (photographerId ? e.photographer_id === photographerId : true))
      .filter((e) => (group === 'rodada' && routeId ? e.event_points.some((pt) => pt.route_point?.route_id === routeId) : true))
      .filter((e) => (q ? e.title.toLowerCase().includes(q) || e.city.toLowerCase().includes(q) : true))
      .sort((a, b) =>
        sort === 'proximos' ? +new Date(a.event_date) - +new Date(b.event_date) : +new Date(b.event_date) - +new Date(a.event_date),
      )
  }, [events, group, city, category, routeId, photographerId, sort, query])

  const months = useMemo(() => {
    const map = new Map<string, PublicEvent[]>()
    for (const e of filtered) {
      const key = monthKey(e.event_date)
      const list = map.get(key) ?? []
      list.push(e)
      map.set(key, list)
    }
    const now = monthKey(new Date().toISOString())
    return [...map.entries()]
      .sort((a, b) => (sort === 'proximos' ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0])))
      .map(([key, list]) => ({ key, label: monthLabel(list[0].event_date), events: list, isPast: key < now }))
  }, [filtered, sort])

  const activeFilterCount = [city, photographerId].filter(Boolean).length

  // Mismo bloque (pastilla + tabs + botón Filtros) tanto en la página como
  // en el header transformado — se registra tal cual una vez que se hizo
  // scroll, igual que en Studio, para que el filtro principal siga
  // alcanzable sin volver arriba. Solo uno de los dos está realmente
  // visible en un momento dado (el de la página desaparece de la vista al
  // scrollear lo suficiente para que el header se transforme). En el
  // header se oculta el buscador propio del FilterBar (`hideSearch`) — el
  // disparador de búsqueda global ya vive justo al lado ahí, no hace
  // falta un segundo campo de texto compitiendo por el mismo espacio
  // angosto.
  function renderFilterRow(hideSearch: boolean) {
    return (
      <div className="flex w-full min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <FilterBar
          className="!border-none min-w-0 flex-1 !pb-0"
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar evento o ciudad…"
          hideSearch={hideSearch}
          segments={[
            { value: 'rodada', label: 'Rodada' },
            { value: 'evento', label: 'Evento' },
          ]}
          segmentValue={group}
          onSegmentChange={setGroup}
          tabs={group === 'rodada' ? ROUTE_TABS : group === 'evento' ? EVENT_TYPE_TABS : []}
          tabValue={group === 'rodada' ? routeId : category}
          onTabChange={(v) => setParam(group === 'rodada' ? 'ruta' : 'categoria', v || undefined)}
        />
        <button
          onClick={() => setFiltersOpen(true)}
          className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
        >
          <IconFilter className="h-4 w-4" />
          <span className="hidden lg:inline">Filtros</span>
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>
    )
  }

  useHeaderTransform(renderFilterRow(true), scrolledPast)

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 font-flat md:px-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">Eventos</h1>
      <p className="mb-6 text-muted-foreground">
        {filtered.length} eventos · descubre rodadas, pistas y sesiones cerca de ti
      </p>

      <div className="mb-8 border-b border-border pb-4">{renderFilterRow(false)}</div>

      <EventsFilterModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        cityOptions={CITIES.map((c) => ({ value: c, label: c }))}
        photographerOptions={photographers.map((p) => ({ value: p.id, label: p.display_name }))}
        city={city}
        photographerId={photographerId}
        sort={sort}
        onChange={(key, value) => setParam(key, value)}
        resultCount={filtered.length}
      />

      {isLoading && <SkeletonGrid count={6} className="sm:grid-cols-2 lg:grid-cols-3" />}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
          <span className="text-4xl opacity-40">🔍</span>
          <p className="font-semibold">No hay eventos con esos filtros</p>
          <p className="text-sm text-muted-foreground">Prueba con otra ciudad, ruta o fotógrafo.</p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="flex flex-col gap-8">
          {months.map((month) => (
            <MonthSection key={month.key} label={month.label} events={month.events} photosByEvent={photosByEvent} defaultOpen={!month.isPast} />
          ))}
        </div>
      )}
    </div>
  )
}
