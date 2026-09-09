import { Link } from 'react-router-dom'
import type { PublicEvent } from '../usePublicData'
import type { DbPhoto } from '../../../types/db'
import { Badge } from '../../../ui/flat/Badge'
import { r2Url } from '../../../lib/r2'
import { EventCoverMedia } from '../../../ui/shared/EventCoverMedia'
import { IconUser } from '../../../ui/shared/icons'
import { PhotoCarousel } from './PhotoCarousel'

/** Misma tarjeta de evento que `StudioEventCard` (portal del fotógrafo) —
 * comparten el bloque de portada (`EventCoverMedia`: zoom de hover,
 * degradado, posición de insignias). El contenido de abajo es distinto
 * porque aquí lo relevante para un biker es quién cubre el evento y
 * cuánto cuesta, no la cantidad de puntos/fotos.
 * El fotógrafo aparece TANTO en un chip sobre la portada como en el
 * bloque de abajo — a propósito: con muchos fotógrafos nombrando sus
 * rodadas solo con la fecha, es fácil que dos eventos de fotógrafos
 * distintos se llamen casi igual, así que quién lo cubre debe notarse de
 * un vistazo, no solo al leer hasta el final de la tarjeta. */
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
          statusSlot={
            <span className="flex max-w-[160px] items-center gap-1.5 rounded-full border border-white/20 bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white">
              <IconUser className="h-3 w-3 shrink-0" />
              <span className="truncate">{event.photographer?.display_name ?? 'Fotógrafo'}</span>
            </span>
          }
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
