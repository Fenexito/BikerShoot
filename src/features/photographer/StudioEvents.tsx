import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMyEvents } from './useMyEvents'
import { StudioEventCard } from './components/StudioEventCard'
import { Button } from '../../ui/studio/Button'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { StudioFilterBar } from '../../ui/studio/StudioFilterBar'
import { SkeletonGrid } from '../../ui/shared/Skeleton'

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

  // Cambia junto con cualquier filtro — al usarlo como `key` del grid,
  // React desmonta y vuelve a montar las tarjetas visibles en vez de solo
  // reordenar el DOM existente, así la animación de entrada (escalonada)
  // se vuelve a disparar cada vez que el resultado del filtro cambia.
  const filterSignature = `${status}:${query.trim().toLowerCase()}`

  return (
    <div className={STUDIO_PAGE_WIDE}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">Tus eventos</h1>
          <p className="mt-2 text-muted-foreground">{events?.length ?? 0} eventos publicados</p>
        </div>
        <Link to="/studio/eventos/new">
          <Button variant="dark">+ Crear evento</Button>
        </Link>
      </div>

      {events && events.length > 0 && (
        <StudioFilterBar
          className="mb-8"
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar evento o ciudad…"
          tabs={STATUS_TABS.map((t) => ({
            value: t.value,
            label: t.label,
            count: t.value === 'todos' ? events.length : events.filter((e) => e.status === t.value).length,
          }))}
          tabValue={status}
          onTabChange={(v) => setStatus(v as (typeof STATUS_TABS)[number]['value'])}
        />
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

      <div key={filterSignature} className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((event, i) => (
          <div key={event.id} className="animate-card-in" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
            <StudioEventCard event={event} photographerId={user?.id} />
          </div>
        ))}
      </div>
    </div>
  )
}
