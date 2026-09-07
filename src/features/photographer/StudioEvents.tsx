import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMyEvents } from './useMyEvents'
import { StudioEventCard } from './components/StudioEventCard'
import { Button } from '../../ui/studio/Button'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { SkeletonGrid } from '../../ui/shared/Skeleton'

export function StudioEvents() {
  const { user } = useAuth()
  const { data: events, isLoading, error } = useMyEvents(user?.id)

  return (
    <div className={STUDIO_PAGE_WIDE}>
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">Tus eventos</h1>
          <p className="mt-2 text-muted-foreground">{events?.length ?? 0} eventos publicados</p>
        </div>
        <Link to="/studio/eventos/new">
          <Button variant="dark">+ Crear evento</Button>
        </Link>
      </div>

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

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {events?.map((event) => (
          <StudioEventCard key={event.id} event={event} photographerId={user?.id} />
        ))}
      </div>
    </div>
  )
}
