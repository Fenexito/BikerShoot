import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { usePublicEvent, useEventPhotos } from './usePublicData'
import { PhotoGrid, type GridPhoto } from './components/PhotoGrid'
import { PhotoLightbox } from './components/PhotoLightbox'
import { Select } from '../../ui/flat/Select'
import { Button } from '../../ui/flat/Button'
import { Badge } from '../../ui/flat/Badge'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { useCartStore } from '../cart/cartStore'
import { PlaceholderPage } from '../auth/PlaceholderPage'

export function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: event, isLoading } = usePublicEvent(id)
  const { data: photos = [] } = useEventPhotos(id)
  const [motoBrand, setMotoBrand] = useState('')
  const [lightbox, setLightbox] = useState<{ photos: GridPhoto[]; index: number } | null>(null)
  const cartItems = useCartStore((s) => s.items)

  const pointId = searchParams.get('punto') ?? ''
  const selectedPoint = event?.event_points.find((pt) => pt.id === pointId)

  useEffect(() => {
    if (pointId && event && !selectedPoint) {
      const next = new URLSearchParams(searchParams)
      next.delete('punto')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointId, event, selectedPoint])

  function setPointId(value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set('punto', value)
    else next.delete('punto')
    setSearchParams(next, { replace: true })
  }

  const brands = useMemo(() => Array.from(new Set(photos.map((p) => p.moto_brand).filter(Boolean))) as string[], [photos])
  const pointFilteredPhotos = pointId ? photos.filter((p) => p.point_id === pointId) : photos
  const filteredPhotos = motoBrand ? pointFilteredPhotos.filter((p) => p.moto_brand === motoBrand) : pointFilteredPhotos

  const gridPhotos: GridPhoto[] = filteredPhotos.map((p) => ({
    ...p,
    eventTitle: event?.title ?? '',
    photographerName: event?.photographer?.display_name ?? '',
  }))

  const selectedFromEvent = useMemo(() => cartItems.filter((i) => i.eventId === id).length, [cartItems, id])

  if (isLoading) return <div className="px-6 py-16 text-center text-muted-foreground font-flat">Cargando evento…</div>
  if (!event) return <PlaceholderPage title="Evento no encontrado" />

  const date = new Date(event.event_date)

  return (
    <div className="pb-24 font-flat">
      <div className="relative flex h-56 items-center justify-center overflow-hidden bg-gradient-to-br from-blue-200 to-emerald-200 md:h-80">
        <span className="text-7xl opacity-30">🏍️</span>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-5xl px-4 pb-6 text-white md:px-8">
          <Badge tone="accent">{event.category}</Badge>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-4xl">{event.title}</h1>
          <p className="mt-1 text-white/90">
            {date.toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })}
            {event.venue ? ` · ${event.venue}` : ''}, {event.city}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-muted p-5">
          <Link to={`/app/fotografos/${event.photographer_id}`} className="flex items-center gap-3">
            <InitialsAvatar name={event.photographer?.display_name ?? '?'} className="h-12 w-12 rounded-full bg-primary text-sm text-white" />
            <div>
              <p className="font-bold">{event.photographer?.display_name}</p>
              <p className="text-sm text-muted-foreground">Fotógrafo del evento</p>
            </div>
          </Link>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Desde</p>
            <p className="text-xl font-bold text-primary">Q{event.price_per_photo} / foto</p>
          </div>
        </div>

        {event.description && <p className="mt-6 max-w-2xl text-muted-foreground">{event.description}</p>}

        <div className="mt-4 inline-flex items-center gap-2 rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-700">
          💡 Compra 5 fotos o más de este evento y ahorra 15% automáticamente en el carrito.
        </div>

        {selectedPoint && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-primary/10 px-4 py-3 text-sm">
            <span>
              📍 Viendo solo el punto <strong>{selectedPoint.label}</strong> ({selectedPoint.time_start.slice(0, 5)}–{selectedPoint.time_end.slice(0, 5)})
            </span>
            <button onClick={() => setPointId('')} className="font-semibold text-primary underline">
              Ver todas las fotos del evento
            </button>
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">{filteredPhotos.length} fotos {selectedPoint ? 'de este punto' : 'del evento'}</h2>
          <div className="flex flex-wrap gap-3">
            {event.event_points.length > 1 && (
              <Select value={pointId} onChange={(e) => setPointId(e.target.value)} className="w-56">
                <option value="">Todos los puntos</option>
                {event.event_points.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.label} ({pt.time_start.slice(0, 5)}–{pt.time_end.slice(0, 5)})
                  </option>
                ))}
              </Select>
            )}
            {brands.length > 0 && (
              <Select value={motoBrand} onChange={(e) => setMotoBrand(e.target.value)} className="w-48">
                <option value="">Toda marca de moto</option>
                {brands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </Select>
            )}
          </div>
        </div>

        <div className="mt-6">
          <PhotoGrid photos={gridPhotos} onOpenPhoto={(photos, index) => setLightbox({ photos, index })} />
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
