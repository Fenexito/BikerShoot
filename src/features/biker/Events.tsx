import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePublicEvents, useApprovedPhotographers, useFeaturedEventPhotos } from './usePublicData'
import { useRoutes } from '../shared/useRoutes'
import { EventCard } from './components/EventCard'
import { FancySelect } from '../../ui/shared/FancySelect'
import { FilterBar, type FilterOption } from '../../ui/shared/FilterBar'
import { SkeletonGrid } from '../../ui/shared/Skeleton'
import { useHeaderTransform } from '../../ui/layout/useHeaderTransform'
import { useScrolledPast } from '../../ui/shared/useScrolledPast'
import { IconSearch } from '../../ui/shared/icons'
import type { DbPhoto } from '../../types/db'

type EventGroup = 'rodada' | 'evento'

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
const SORTS: { value: string; label: string }[] = [
  { value: 'recientes', label: 'Más recientes' },
  { value: 'proximos', label: 'Próximamente' },
]

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
  const group = (searchParams.get('tipo') as EventGroup | null) ?? 'rodada'
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
    // Cambiar de pastilla resetea ruta/categoría — son sub-filtros del
    // grupo anterior, no tendría sentido conservarlos.
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
      .filter((e) => (group === 'rodada' ? e.category === 'Rodada' : e.category !== 'Rodada'))
      .filter((e) => (city ? e.city === city : true))
      .filter((e) => (group === 'evento' && category ? e.category === category : true))
      .filter((e) => (photographerId ? e.photographer_id === photographerId : true))
      .filter((e) => (group === 'rodada' && routeId ? e.event_points.some((pt) => pt.route_point?.route_id === routeId) : true))
      .filter((e) => (q ? e.title.toLowerCase().includes(q) || e.city.toLowerCase().includes(q) : true))
      .sort((a, b) =>
        sort === 'proximos' ? +new Date(a.event_date) - +new Date(b.event_date) : +new Date(b.event_date) - +new Date(a.event_date),
      )
  }, [events, group, city, category, routeId, photographerId, sort, query])

  const activeFilterCount = [city, photographerId].filter(Boolean).length

  useHeaderTransform(
    <div className="flex w-full min-w-0 items-center gap-2 rounded-full bg-muted px-4 py-2">
      <IconSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar evento o ciudad…"
        className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>,
    scrolledPast,
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 font-flat md:px-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">Eventos</h1>
      <p className="mb-6 text-muted-foreground">
        {filtered.length} eventos · descubre rodadas, pistas y sesiones cerca de ti
      </p>

      <FilterBar
        className="mb-6"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Buscar evento o ciudad…"
        segments={[
          { value: 'rodada', label: 'Rodada' },
          { value: 'evento', label: 'Evento' },
        ]}
        segmentValue={group}
        onSegmentChange={setGroup}
        tabs={group === 'rodada' ? ROUTE_TABS : EVENT_TYPE_TABS}
        tabValue={group === 'rodada' ? routeId : category}
        onTabChange={(v) => setParam(group === 'rodada' ? 'ruta' : 'categoria', v || undefined)}
      />

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="flex gap-5 border-b border-border">
          {SORTS.map((s) => (
            <button
              key={s.value}
              onClick={() => setParam('orden', s.value === 'recientes' ? undefined : s.value)}
              className={`border-b-2 pb-3 text-sm font-semibold transition-colors ${sort === s.value ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <FancySelect
          value={city}
          onChange={(v) => setParam('ciudad', v || undefined)}
          options={CITIES.map((c) => ({ value: c, label: c }))}
          placeholder="Toda ciudad"
          className="w-40"
        />
        {photographers.length > 0 && (
          <FancySelect
            value={photographerId}
            onChange={(v) => setParam('fotografo', v || undefined)}
            options={photographers.map((p) => ({ value: p.id, label: p.display_name }))}
            placeholder="Todo fotógrafo"
            className="w-48"
          />
        )}
        {activeFilterCount > 0 && (
          <button
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              next.delete('ciudad')
              next.delete('fotografo')
              setSearchParams(next, { replace: true })
            }}
            className="text-sm font-medium text-muted-foreground underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {isLoading && <SkeletonGrid count={6} className="sm:grid-cols-2 lg:grid-cols-3" />}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
          <span className="text-4xl opacity-40">🔍</span>
          <p className="font-semibold">No hay eventos con esos filtros</p>
          <p className="text-sm text-muted-foreground">Prueba con otra ciudad, ruta o fotógrafo.</p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((event, i) => (
            <div key={event.id} className="animate-[fade-in-up_.4s_ease-out_backwards]" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <EventCard event={event} photos={photosByEvent.get(event.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
