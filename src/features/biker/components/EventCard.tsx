import { Link } from 'react-router-dom'
import type { MotoEvent } from '../../../data/mockPhotos'
import { thumbUrl, getPhotographerById, getPhotosByEvent } from '../../../data/mockPhotos'
import { Badge } from '../../../ui/flat/Badge'

export function EventCard({ event }: { event: MotoEvent }) {
  const photographer = getPhotographerById(event.photographerId)
  const photoCount = getPhotosByEvent(event.id).length
  const date = new Date(event.date)

  return (
    <Link
      to={`/app/eventos/${event.id}`}
      className="group block overflow-hidden rounded-lg bg-muted transition-transform duration-200 hover:scale-[1.02]"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={thumbUrl(event.coverSeed, 500, 380)}
          alt={event.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-2 top-2">
          <Badge tone="accent">{event.category}</Badge>
        </div>
        <div className="absolute bottom-2 right-2 rounded-full bg-white px-2.5 py-1 text-xs font-bold">
          {photoCount} fotos
        </div>
      </div>
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {date.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })} · {event.city}
        </p>
        <h3 className="mt-1 truncate text-lg font-bold">{event.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Por {photographer?.name} · desde Q{event.pricePerPhoto}</p>
      </div>
    </Link>
  )
}
