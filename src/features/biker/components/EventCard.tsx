import { Link } from 'react-router-dom'
import type { PublicEvent } from '../usePublicData'
import type { DbPhoto } from '../../../types/db'
import { Badge } from '../../../ui/flat/Badge'
import { r2Url } from '../../../lib/r2'
import { EventCoverMedia } from '../../../ui/shared/EventCoverMedia'
import { PhotoCarousel } from './PhotoCarousel'

/** Misma tarjeta de evento que `StudioEventCard` (portal del fotógrafo) —
 * comparten el bloque de portada (`EventCoverMedia`: zoom de hover,
 * degradado, posición de insignias). El contenido de abajo es distinto
 * porque aquí lo relevante para un biker es quién cubre el evento y
 * cuánto cuesta, no la cantidad de puntos/fotos. */
export function EventCard({ event, photos = [] }: { event: PublicEvent; photos?: DbPhoto[] }) {
  const date = new Date(event.event_date)

  return (
    <div className="group overflow-hidden rounded-3xl border border-border transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl">
      <Link to={`/app/eventos/${event.id}`} className="block">
        <EventCoverMedia
          coverUrl={event.cover_path ? r2Url(event.cover_path) : null}
          placeholderIcon="🏍️"
          media={photos.length > 0 ? <PhotoCarousel photos={photos} /> : undefined}
          categorySlot={<Badge tone="dark">{event.category}</Badge>}
        />
        <div className="px-5 pb-5 pt-5">
          <h3 className="truncate text-lg font-bold">{event.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {date.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })} · {event.city}
          </p>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{event.photographer?.display_name ?? 'Fotógrafo'}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fotógrafo</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-bold text-primary">Q{event.price_per_photo}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Por foto</p>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}
