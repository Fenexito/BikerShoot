import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePublicEvent, useEventPhotos, type PublicEventPoint } from './usePublicData'
import { PhotoGrid, type GridPhoto } from './components/PhotoGrid'
import { PhotoLightbox } from './components/PhotoLightbox'
import { Button } from '../../ui/flat/Button'
import { Badge } from '../../ui/flat/Badge'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { IconChevronRight } from '../../ui/shared/icons'
import { useCartStore } from '../cart/cartStore'
import { PlaceholderPage } from '../auth/PlaceholderPage'
import { Skeleton, SkeletonGrid } from '../../ui/shared/Skeleton'
import { r2Url, previewUrl } from '../../lib/r2'
import ScrollExpand from '../../ui/reactbits/ScrollExpand'
import AccordionGallery from '../../ui/reactbits/AccordionGallery'
import type { DbPhoto } from '../../types/db'

const MAX_PER_ROW = 12
const MAX_PER_POINT = MAX_PER_ROW * 2

function splitInTwo<T>(arr: T[]): [T[], T[]] {
  const capped = arr.slice(0, MAX_PER_POINT)
  const mid = Math.ceil(capped.length / 2)
  return [capped.slice(0, mid), capped.slice(mid)]
}

/** Fila de galería tipo acordeón para el biker — misma animación hover que
 * el portal del fotógrafo, pero sin overlay de administración (solo abre
 * el lightbox), y más alta porque casi todas las fotos son verticales. */
function PointAccordionRow({ rowPhotos, allPhotos, onOpen }: { rowPhotos: DbPhoto[]; allPhotos: DbPhoto[]; onOpen: (index: number) => void }) {
  if (rowPhotos.length === 0) return null
  return (
    <AccordionGallery
      items={rowPhotos.map((photo) => ({ image: previewUrl(photo) }))}
      onOpen={(i) => onOpen(allPhotos.indexOf(rowPhotos[i]))}
      height={440}
      radius={20}
      expandRatio={0.34}
      tilt={6}
      parallax={0.3}
      accentColor="rgb(37 99 235)"
      overlayColor="#000000"
      showLabels={false}
      defaultIndex={0}
    />
  )
}

function PointSection({
  point,
  photos,
  onOpenLightbox,
  onSeeMore,
}: {
  point: PublicEventPoint
  photos: DbPhoto[]
  onOpenLightbox: (photos: DbPhoto[], index: number, pointLabel?: string) => void
  onSeeMore: (point: PublicEventPoint) => void
}) {
  const [rowA, rowB] = splitInTwo(photos)
  if (photos.length === 0) return null

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold tracking-tight">📍 {point.label}</h3>
          <p className="text-sm text-muted-foreground">
            {point.time_start.slice(0, 5)}–{point.time_end.slice(0, 5)} · {photos.length} fotos
          </p>
        </div>
        <button
          onClick={() => onSeeMore(point)}
          className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          Ver todas las fotos de este punto
          <IconChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <PointAccordionRow rowPhotos={rowA} allPhotos={photos} onOpen={(i) => onOpenLightbox(photos, i, point.label)} />
        <PointAccordionRow rowPhotos={rowB} allPhotos={photos} onOpen={(i) => onOpenLightbox(photos, i, point.label)} />
      </div>
    </section>
  )
}

export function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: event, isLoading } = usePublicEvent(id)
  const { data: photos = [] } = useEventPhotos(id)
  const [lightbox, setLightbox] = useState<{ photos: GridPhoto[]; index: number } | null>(null)
  const cartItems = useCartStore((s) => s.items)

  const featuredPhotos = useMemo(() => photos.filter((p) => p.featured), [photos])

  const photosByPoint = useMemo(() => {
    const map = new Map<string, DbPhoto[]>()
    for (const p of photos) {
      if (!p.point_id) continue
      const list = map.get(p.point_id) ?? []
      list.push(p)
      map.set(p.point_id, list)
    }
    return map
  }, [photos])

  const unassignedPhotos = useMemo(() => photos.filter((p) => !p.point_id), [photos])

  const selectedFromEvent = useMemo(() => cartItems.filter((i) => i.eventId === id).length, [cartItems, id])

  function toGridPhotos(list: DbPhoto[], pointLabel?: string): GridPhoto[] {
    return list.map((p) => ({ ...p, eventTitle: event?.title ?? '', photographerName: event?.photographer?.display_name ?? '', pointLabel }))
  }

  function openLightbox(list: DbPhoto[], index: number, pointLabel?: string) {
    setLightbox({ photos: toGridPhotos(list, pointLabel), index })
  }

  function seeMoreOfPoint(point: PublicEventPoint) {
    const params = new URLSearchParams()
    if (id) params.set('evento', id)
    if (event?.photographer_id) params.set('fotografo', event.photographer_id)
    if (point.route_point?.route_id) params.set('ruta', point.route_point.route_id)
    params.set('punto', point.id)
    navigate(`/app/buscar?${params.toString()}`)
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 font-flat md:px-8">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="mt-3 h-4 w-1/3" />
        <SkeletonGrid count={8} className="mt-8" />
      </div>
    )
  }
  if (!event) return <PlaceholderPage title="Evento no encontrado" />

  const date = new Date(event.event_date)
  const coverUrl = event.cover_path ? r2Url(event.cover_path) : null

  return (
    <div className="pb-24 font-flat">
      {coverUrl ? (
        <ScrollExpand
          src={coverUrl}
          alt={event.title}
          title={event.title}
          scrollHint="Desliza para ver el evento"
          useWindowScroll
          startWidth={60}
          startHeight={60}
          startRadius={36}
          endRadius={1}
          mediaZoom={1.5}
          scrollDistance={1}
          holdDistance={0.45}
          smoothing={0.3}
          overlayScrim={0.5}
        />
      ) : (
        <div className="relative flex h-56 items-center justify-center overflow-hidden bg-gradient-to-br from-blue-200 to-emerald-200 md:h-80">
          <span className="text-7xl opacity-30">🏍️</span>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="accent">{event.category}</Badge>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-4xl">{event.title}</h1>
            <p className="mt-1 text-muted-foreground">
              {date.toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })}
              {event.venue ? ` · ${event.venue}` : ''}, {event.city}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Desde</p>
            <p className="text-2xl font-bold text-primary">Q{event.price_per_photo} / foto</p>
          </div>
        </div>

        <Link
          to={`/app/fotografos/${event.photographer_id}`}
          className="mt-6 flex items-center justify-between gap-4 rounded-3xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
        >
          <div className="flex items-center gap-3">
            <InitialsAvatar name={event.photographer?.display_name ?? '?'} className="h-12 w-12 rounded-full bg-primary text-sm text-white" />
            <div>
              <p className="font-bold">{event.photographer?.display_name}</p>
              <p className="text-sm text-muted-foreground">Ver perfil del fotógrafo</p>
            </div>
          </div>
          <IconChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>

        {event.description && <p className="mt-6 max-w-2xl text-muted-foreground">{event.description}</p>}

        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm text-amber-700">
          💡 Compra 5 fotos o más de este evento y ahorra 15% automáticamente en el carrito.
        </div>

        {featuredPhotos.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-bold tracking-tight">✨ Fotos destacadas</h2>
            <PhotoGrid photos={toGridPhotos(featuredPhotos)} onOpenPhoto={(list, i) => setLightbox({ photos: list, index: i })} />
          </section>
        )}

        {event.event_points.map((point) => (
          <PointSection
            key={point.id}
            point={point}
            photos={photosByPoint.get(point.id) ?? []}
            onOpenLightbox={openLightbox}
            onSeeMore={seeMoreOfPoint}
          />
        ))}

        {unassignedPhotos.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-bold tracking-tight">Más fotos del evento</h2>
            <PhotoGrid photos={toGridPhotos(unassignedPhotos)} onOpenPhoto={(list, i) => setLightbox({ photos: list, index: i })} />
          </section>
        )}

        {photos.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
            <span className="text-4xl opacity-40">📷</span>
            <p className="font-semibold">Este evento todavía no tiene fotos publicadas</p>
          </div>
        )}
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
