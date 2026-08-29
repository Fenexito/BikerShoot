import { Link } from 'react-router-dom'
import type { PublicEvent } from '../usePublicData'
import { Badge } from '../../../ui/flat/Badge'

export function EventCard({ event }: { event: PublicEvent }) {
  const date = new Date(event.event_date)

  return (
    <Link
      to={`/app/eventos/${event.id}`}
      className="group block overflow-hidden rounded-lg bg-muted transition-transform duration-200 hover:scale-[1.02]"
    >
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br from-blue-100 to-emerald-100">
        <span className="text-4xl opacity-40">🏍️</span>
        <div className="absolute left-2 top-2">
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
