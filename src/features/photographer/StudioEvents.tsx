import { Link } from 'react-router-dom'
import { studioEvents, thumbUrlStudio } from '../../data/mockStudio'
import { Badge } from '../../ui/studio/Badge'
import { Button } from '../../ui/studio/Button'

export function StudioEvents() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 text-foreground md:px-16">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">Tus eventos</h1>
          <p className="mt-2 text-muted-foreground">{studioEvents.length} eventos publicados</p>
        </div>
        <Link to="/studio/eventos/new">
          <Button variant="secondary">+ Crear evento</Button>
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {studioEvents.map((event) => (
          <Link
            key={event.id}
            to={`/studio/eventos/${event.id}`}
            className="group overflow-hidden border border-border transition-colors duration-150 hover:border-border-hover"
          >
            <div className="relative h-40 overflow-hidden">
              <img
                src={thumbUrlStudio(event.coverSeed, 400, 220)}
                alt={event.title}
                className="h-full w-full object-cover grayscale transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute left-3 top-3">
                <Badge>{event.category}</Badge>
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-studio text-lg font-bold">{event.title}</h3>
                <span className="font-studio-mono text-[10px] uppercase tracking-wider2 text-muted-foreground">
                  {event.status === 'activo' ? '● Activo' : 'Cerrado'}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{event.city} · {new Date(event.date).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
                <div>
                  <p className="font-studio text-lg font-bold">{event.photosCount}</p>
                  <p className="font-studio-mono text-[10px] uppercase text-muted-foreground">Fotos</p>
                </div>
                <div>
                  <p className="font-studio text-lg font-bold">{event.salesCount}</p>
                  <p className="font-studio-mono text-[10px] uppercase text-muted-foreground">Ventas</p>
                </div>
                <div>
                  <p className="font-studio text-lg font-bold">{event.points.length}</p>
                  <p className="font-studio-mono text-[10px] uppercase text-muted-foreground">Puntos</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
