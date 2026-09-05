import { Link } from 'react-router-dom'
import type { PublicEvent } from '../usePublicData'
import type { DbPhoto } from '../../../types/db'
import { Badge } from '../../../ui/flat/Badge'
import { r2Url } from '../../../lib/r2'
import { PhotoCarousel } from './PhotoCarousel'

export function EventCard({ event, photos = [] }: { event: PublicEvent; photos?: DbPhoto[] }) {
  const date = new Date(event.event_date)

  return (
    <Link
      to={`/app/eventos/${event.id}`}
      className="group block overflow-hidden rounded-3xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-blue-100 to-emerald-100">
        {photos.length > 0 ? (
          <PhotoCarousel photos={photos} />
        ) : event.cover_path ? (
          <img src={r2Url(event.cover_path)} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-4xl opacity-40 transition-transform duration-500 group-hover:scale-110">🏍️</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute left-3 top-3 z-10">
          <Badge tone="accent">{event.category}</Badge>
        </div>
      </div>
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {date.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })} · {event.city}
        </p>
        <h3 className="mt-1 truncate text-lg font-bold">{event.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Por {event.photographer?.display_name ?? 'Fotógrafo'} · desde Q{event.price_per_photo}
        </p>
      </div>
    </Link>
  )
}
