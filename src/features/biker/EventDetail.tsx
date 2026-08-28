import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getEventById, getPhotographerById, getPhotosByEvent, thumbUrl, type Photo } from '../../data/mockPhotos'
import { PhotoGrid } from './components/PhotoGrid'
import { PhotoLightbox } from './components/PhotoLightbox'
import { Select } from '../../ui/flat/Select'
import { Button } from '../../ui/flat/Button'
import { Badge } from '../../ui/flat/Badge'
import { useCartStore } from '../cart/cartStore'
import { PlaceholderPage } from '../auth/PlaceholderPage'

export function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const event = getEventById(id ?? '')
  const [motoBrand, setMotoBrand] = useState('')
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number } | null>(null)
  const cartItems = useCartStore((s) => s.items)

  if (!event) return <PlaceholderPage title="Evento no encontrado" />

  const photographer = getPhotographerById(event.photographerId)
  const allEventPhotos = getPhotosByEvent(event.id)
  const brands = Array.from(new Set(allEventPhotos.map((p) => p.motoBrand)))
  const photos = motoBrand ? allEventPhotos.filter((p) => p.motoBrand === motoBrand) : allEventPhotos

  const selectedFromEvent = useMemo(() => cartItems.filter((i) => i.eventId === event.id).length, [cartItems, event.id])
  const date = new Date(event.date)

  return (
    <div className="pb-24 font-flat">
      <div className="relative h-56 md:h-80">
        <img src={thumbUrl(event.coverSeed, 1400, 500)} alt={event.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-5xl px-4 pb-6 text-white md:px-8">
          <Badge tone="accent">{event.category}</Badge>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-4xl">{event.title}</h1>
          <p className="mt-1 text-white/90">
            {date.toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })} · {event.venue}, {event.city}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-muted p-5">
          <Link to={`/app/fotografos/${event.photographerId}`} className="flex items-center gap-3">
            <img src={thumbUrl(photographer?.avatarSeed ?? '', 48, 48)} alt="" className="h-12 w-12 rounded-full object-cover" />
            <div>
              <p className="font-bold">{photographer?.name}</p>
              <p className="text-sm text-muted-foreground">Fotógrafo del evento</p>
            </div>
          </Link>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Desde</p>
            <p className="text-xl font-bold text-primary">Q{event.pricePerPhoto} / foto</p>
          </div>
        </div>

        <p className="mt-6 max-w-2xl text-muted-foreground">{event.description}</p>

        <div className="mt-4 inline-flex items-center gap-2 rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-700">
          💡 Compra 5 fotos o más de este evento y ahorra 15% automáticamente en el carrito.
        </div>

        <div className="mt-10 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">{allEventPhotos.length} fotos del evento</h2>
          <Select value={motoBrand} onChange={(e) => setMotoBrand(e.target.value)} className="w-48">
            <option value="">Toda marca de moto</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </Select>
        </div>

        <div className="mt-6">
          <PhotoGrid photos={photos} onOpenPhoto={(photos, index) => setLightbox({ photos, index })} />
        </div>
      </div>

      {selectedFromEvent > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 px-4 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <p className="font-semibold">
              {selectedFromEvent} foto{selectedFromEvent > 1 ? 's' : ''} seleccionada{selectedFromEvent > 1 ? 's' : ''} de este evento
            </p>
            <Button onClick={() => navigate('/app/checkout')}>Ver carrito</Button>
          </div>
        </div>
      )}

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(index) => setLightbox({ photos: lightbox.photos, index })}
        />
      )}
    </div>
  )
}
