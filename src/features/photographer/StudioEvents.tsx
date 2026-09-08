import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMyEvents } from './useMyEvents'
import { StudioEventCard } from './components/StudioEventCard'
import { Button } from '../../ui/studio/Button'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { SkeletonGrid } from '../../ui/shared/Skeleton'
import { IconSearch } from '../../ui/shared/icons'
import { cn } from '../../lib/cn'

const STATUS_TABS: { value: 'todos' | 'activo' | 'pausado' | 'cerrado'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'activo', label: 'Activos' },
  { value: 'pausado', label: 'Pausados' },
  { value: 'cerrado', label: 'Cerrados' },
]

export function StudioEvents() {
  const { user } = useAuth()
  const { data: events, isLoading, error } = useMyEvents(user?.id)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]['value']>('todos')

  const filtered = useMemo(() => {
    let list = events ?? []
    if (status !== 'todos') list = list.filter((e) => e.status === status)
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((e) => e.title.toLowerCase().includes(q) || e.city.toLowerCase().includes(q))
    return list
  }, [events, status, query])

  return (
    <div className={STUDIO_PAGE_WIDE}>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">Tus eventos</h1>
          <p className="mt-2 text-muted-foreground">{events?.length ?? 0} eventos publicados</p>
        </div>
        <Link to="/studio/eventos/new">
          <Button variant="dark">+ Crear evento</Button>
        </Link>
      </div>

      {events && events.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-full bg-muted px-4 py-2 sm:max-w-xs">
            <IconSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar evento o ciudad…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((t) => {
              const count = t.value === 'todos' ? events.length : events.filter((e) => e.status === t.value).length
              return (
                <button
                  key={t.value}
                  onClick={() => setStatus(t.value)}
                  className={cn(
                    'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    status === t.value ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-border hover:text-foreground',
                  )}
                >
                  {t.label} <span className="opacity-70">({count})</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {isLoading && <SkeletonGrid count={6} className="md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" />}
      {error && <p className="text-accent">No se pudieron cargar tus eventos.</p>}

      {events && events.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border px-6 py-20 text-center">
          <span className="text-4xl opacity-40">🏍️</span>
          <p className="font-semibold">Todavía no tienes eventos</p>
          <Link to="/studio/eventos/new">
            <Button variant="secondary" size="sm" className="mt-2">+ Crear tu primer evento</Button>
          </Link>
        </div>
      )}

      {events && events.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border px-6 py-20 text-center">
          <span className="text-4xl opacity-40">🔍</span>
          <p className="font-semibold">Ningún evento coincide con ese filtro</p>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((event) => (
          <StudioEventCard key={event.id} event={event} photographerId={user?.id} />
        ))}
      </div>
    </div>
  )
}
