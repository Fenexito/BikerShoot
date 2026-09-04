import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePublicEvents } from './usePublicData'
import { EventCard } from './components/EventCard'
import { Select } from '../../ui/flat/Select'
import { SkeletonGrid } from '../../ui/shared/Skeleton'
import { cn } from '../../lib/cn'

const CATEGORIES = ['Rodada', 'Pista', 'Sesión de Fotos']

export function Events() {
  const { data: events = [], isLoading } = usePublicEvents()
  const [searchParams, setSearchParams] = useSearchParams()
  const city = searchParams.get('ciudad') ?? ''
  const category = searchParams.get('categoria') ?? ''

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const CITIES = useMemo(() => Array.from(new Set(events.map((e) => e.city))), [events])

  const filtered = useMemo(() => {
    return [...events]
      .filter((e) => (city ? e.city === city : true))
      .filter((e) => (category ? e.category === category : true))
      .sort((a, b) => +new Date(b.event_date) - +new Date(a.event_date))
  }, [events, city, category])

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 font-flat md:px-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">Eventos</h1>
      <p className="mb-6 text-muted-foreground">{filtered.length} eventos</p>

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
        <Select value={city} onChange={(e) => setParam('ciudad', e.target.value || undefined)} className="w-44">
          <option value="">Toda ciudad</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </div>

      {isLoading && <SkeletonGrid count={6} className="sm:grid-cols-2 lg:grid-cols-3" />}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
          <span className="text-4xl opacity-40">🔍</span>
          <p className="font-semibold">No hay eventos con esos filtros</p>
          <p className="text-sm text-muted-foreground">Prueba con otra ciudad o categoría.</p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((event, i) => (
            <div key={event.id} className="animate-[fade-in-up_.4s_ease-out_backwards]" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <EventCard event={event} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
