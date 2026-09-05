import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePublicEvents, useApprovedPhotographers, useFeaturedEventPhotos } from './usePublicData'
import { useRoutes } from '../shared/useRoutes'
import { EventCard } from './components/EventCard'
import { FancySelect } from '../../ui/shared/FancySelect'
import { SkeletonGrid } from '../../ui/shared/Skeleton'
import { cn } from '../../lib/cn'
import type { DbPhoto } from '../../types/db'

const CATEGORIES = ['Rodada', 'Pista', 'Sesión de Fotos']
const SORTS: { value: string; label: string }[] = [
  { value: 'recientes', label: 'Más recientes' },
  { value: 'proximos', label: 'Próximamente' },
]

export function Events() {
  const { data: events = [], isLoading } = usePublicEvents()
  const { data: photographers = [] } = useApprovedPhotographers()
  const { data: routes = [] } = useRoutes()
  const { data: featuredPhotos = [] } = useFeaturedEventPhotos()
  const [searchParams, setSearchParams] = useSearchParams()
  const city = searchParams.get('ciudad') ?? ''
  const category = searchParams.get('categoria') ?? ''
  const routeId = searchParams.get('ruta') ?? ''
  const photographerId = searchParams.get('fotografo') ?? ''
  const sort = searchParams.get('orden') ?? 'recientes'

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const CITIES = useMemo(() => Array.from(new Set(events.map((e) => e.city))), [events])

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
    return [...events]
      .filter((e) => (city ? e.city === city : true))
      .filter((e) => (category ? e.category === category : true))
      .filter((e) => (photographerId ? e.photographer_id === photographerId : true))
      .filter((e) => (routeId ? e.event_points.some((pt) => pt.route_point?.route_id === routeId) : true))
      .sort((a, b) =>
        sort === 'proximos' ? +new Date(a.event_date) - +new Date(b.event_date) : +new Date(b.event_date) - +new Date(a.event_date),
      )
  }, [events, city, category, routeId, photographerId, sort])

  const activeFilterCount = [city, category, routeId, photographerId].filter(Boolean).length

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 font-flat md:px-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">Eventos</h1>
      <p className="mb-6 text-muted-foreground">
        {filtered.length} eventos · descubre rodadas, pistas y sesiones cerca de ti
      </p>

      <div className="mb-4 flex gap-6 border-b border-border">
        {SORTS.map((s) => (
          <button
            key={s.value}
            onClick={() => setParam('orden', s.value === 'recientes' ? undefined : s.value)}
            className={cn(
              'border-b-2 pb-3 text-sm font-semibold transition-colors',
              sort === s.value ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setParam('categoria', undefined)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              !category ? 'bg-primary text-white' : 'bg-muted text-foreground hover:bg-border',
            )}
          >
            Todas
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setParam('categoria', category === c ? undefined : c)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                category === c ? 'bg-primary text-white' : 'bg-muted text-foreground hover:bg-border',
              )}
            >
              {c}
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
        {routes.length > 0 && (
          <FancySelect
            value={routeId}
            onChange={(v) => setParam('ruta', v || undefined)}
            options={routes.map((r) => ({ value: r.id, label: r.name }))}
            placeholder="Toda ruta"
            className="w-44"
          />
        )}
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
            onClick={() => setSearchParams({}, { replace: true })}
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
