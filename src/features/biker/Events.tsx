import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePublicEvents } from './usePublicData'
import { EventCard } from './components/EventCard'
import { Select } from '../../ui/flat/Select'

const CATEGORIES = ['Rodada', 'Pista', 'Exhibición', 'Concentración']

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

      <div className="mb-8 flex flex-wrap gap-3">
        <Select value={city} onChange={(e) => setParam('ciudad', e.target.value || undefined)} className="w-44">
          <option value="">Toda ciudad</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <Select value={category} onChange={(e) => setParam('categoria', e.target.value || undefined)} className="w-44">
          <option value="">Toda categoría</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </div>

      {isLoading && <p className="text-muted-foreground">Cargando…</p>}
      {!isLoading && filtered.length === 0 && <p className="text-muted-foreground">No hay eventos con esos filtros.</p>}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  )
}
