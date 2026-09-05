import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useEvent, useEventPhotosDetailed, type EventPhoto } from './useMyEvents'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { r2Url, previewUrl } from '../../lib/r2'
import { PhotoUploadQueue } from './components/PhotoUploadQueue'
import { EVENT_STATUS_STYLE } from '../../lib/eventStatus'
import { Button } from '../../ui/studio/Button'
import { StatusPill } from '../../ui/shared/StatusPill'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { useToastStore } from '../../ui/overlays/toastStore'
import { confirmDialog } from '../../ui/overlays/confirmStore'
import { typedConfirmDialog } from '../../ui/overlays/typedConfirmStore'
import { PlaceholderPage } from '../auth/PlaceholderPage'
import { IconTrash } from '../../ui/shared/icons'
import { ScrollToTopButton } from '../../ui/shared/ScrollToTopButton'
import ScrollExpand from '../../ui/reactbits/ScrollExpand'
import { cn } from '../../lib/cn'
import type { EventStatus } from '../../types/db'
import { Skeleton } from '../../ui/shared/Skeleton'

const PAGE_SIZE = 12
const HEADER_SCROLL_THRESHOLD = 200

function PhotoListRow({ photo, onDelete }: { photo: EventPhoto; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <img src={previewUrl(photo)} alt="" className="h-12 w-12 shrink-0 rounded-2xl border border-border object-cover" />
      <p className="min-w-0 flex-1 truncate text-sm" title={photo.original_filename ?? undefined}>
        {photo.original_filename ?? 'Sin nombre registrado'}
      </p>
      {photo.delivered_path && (
        <span className="shrink-0 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Vendida</span>
      )}
      <button onClick={() => onDelete(photo.id)} className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-accent">
        Eliminar
      </button>
    </div>
  )
}

/** Foto limpia por defecto — el overlay (nombre, destacar, eliminar) se
 * activa con CLICK, no hover (el hover no sirve en touch y aquí además la
 * foto ya tiene su propia animación de escala al hacer scroll). Checkbox
 * de selección múltiple siempre visible en la esquina superior izquierda. */
function PhotoTile({
  photo,
  selected,
  onToggleSelect,
  onSetCover,
  onDelete,
}: {
  photo: EventPhoto
  selected: boolean
  onToggleSelect: (id: string) => void
  onSetCover: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted">
      <img
        src={previewUrl(photo)}
        alt={photo.original_filename ?? ''}
        onClick={() => setExpanded((e) => !e)}
        className={cn('h-full w-full cursor-pointer object-cover transition-transform duration-300', expanded && 'scale-105')}
      />

      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleSelect(photo.id)
        }}
        aria-label="Seleccionar foto"
        className={cn(
          'absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors',
          selected ? 'border-foreground bg-foreground text-background' : 'border-white/80 bg-black/25 text-transparent hover:bg-black/40',
        )}
      >
        ✓
      </button>

      {photo.delivered_path ? (
        <span className="absolute right-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
          Vendida
        </span>
      ) : (
        photo.featured && (
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[10px] text-background">★</span>
        )
      )}

      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-2.5 pt-8 transition-opacity duration-200',
          expanded ? 'opacity-100' : 'opacity-0',
        )}
      >
        <p className="truncate text-[11px] text-white/90">{photo.original_filename ?? 'Sin nombre registrado'}</p>
        <div className="pointer-events-auto mt-1.5 flex gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSetCover(photo.id)
            }}
            className="flex-1 rounded-full bg-white/15 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-white/25"
          >
            ★ Portada del evento
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(photo.id)
            }}
            aria-label="Eliminar foto"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-red-500/80"
          >
            <IconTrash className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface PhotoGalleryProps {
  photos: EventPhoto[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSetCover: (id: string) => void
  onDelete: (id: string) => void
}

function PhotoGallery({ photos, selectedIds, onToggleSelect, onSetCover, onDelete }: PhotoGalleryProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const loadMoreRef = useRef<HTMLButtonElement>(null)
  const visible = photos.slice(0, visibleCount)

  if (photos.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay fotos en este punto.</p>
  }

  function handleLoadMore() {
    const prevTop = loadMoreRef.current?.getBoundingClientRect().top ?? 0
    setVisibleCount((c) => c + PAGE_SIZE)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const newTop = loadMoreRef.current?.getBoundingClientRect().top
        if (newTop != null) window.scrollBy({ top: newTop - prevTop, behavior: 'smooth' })
      })
    })
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <div className="flex gap-1 rounded-full bg-muted p-1">
          <button
            onClick={() => setView('grid')}
            className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-colors', view === 'grid' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
          >
            Grid
          </button>
          <button
            onClick={() => setView('list')}
            className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-colors', view === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
          >
            Lista
          </button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {visible.map((photo) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              selected={selectedIds.has(photo.id)}
              onToggleSelect={onToggleSelect}
              onSetCover={onSetCover}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-2xl border border-border">
          {visible.map((photo) => (
            <PhotoListRow key={photo.id} photo={photo} onDelete={onDelete} />
          ))}
        </div>
      )}

      {visibleCount < photos.length && (
        <button
          ref={loadMoreRef}
          onClick={handleLoadMore}
          className="mt-4 w-full rounded-2xl border border-border py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          Ver más fotos ({photos.length - visibleCount} más)
        </button>
      )}
    </div>
  )
}

function PointStack({ photos }: { photos: EventPhoto[] }) {
  const preview = photos.slice(0, 3)
  if (preview.length === 0) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-dashed border-border text-lg opacity-40">
        📷
      </div>
    )
  }
  return (
    <div className="relative h-16 w-16 shrink-0">
      {preview.map((photo, i) => (
        <img
          key={photo.id}
          src={previewUrl(photo)}
          alt=""
          className="absolute h-14 w-14 rounded-2xl border-2 border-background object-cover shadow-sm"
          style={{ left: i * 8, top: i * 6, zIndex: preview.length - i }}
        />
      ))}
    </div>
  )
}

interface PointCardProps {
  point: { id: string; label: string; time_start: string; time_end: string }
  photos: EventPhoto[]
  eventId: string
  photographerId: string
  price: number
  watermarkPath: string | null
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSetCover: (id: string) => void
  onDelete: (id: string) => void
  onUploaded: () => void
}

function PointCard({ point, photos, eventId, photographerId, price, watermarkPath, selectedIds, onToggleSelect, onSetCover, onDelete, onUploaded }: PointCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const sold = photos.filter((p) => p.delivered_path).length

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card transition-colors hover:border-border-hover">
      <button onClick={() => setExpanded((e) => !e)} className="flex w-full flex-wrap items-center gap-4 p-5 text-left">
        <PointStack photos={photos} />
        <div className="min-w-0 flex-1">
          <h2 className="font-studio text-lg font-bold tracking-tight2">{point.label}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {point.time_start.slice(0, 5)} – {point.time_end.slice(0, 5)} · {photos.length} fotos
            {sold > 0 && ` · ${sold} vendidas`}
          </p>
        </div>
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        >
          ↓
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border p-5">
          <div className="mb-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setUploadOpen((o) => !o)}>
              {uploadOpen ? 'Cerrar' : '+ Subir fotos a este punto'}
            </Button>
          </div>
          {uploadOpen && (
            <div className="mb-6">
              <PhotoUploadQueue
                eventId={eventId}
                pointId={point.id}
                photographerId={photographerId}
                price={price}
                watermarkPath={watermarkPath}
                onItemUploaded={onUploaded}
              />
            </div>
          )}
          <PhotoGallery photos={photos} selectedIds={selectedIds} onToggleSelect={onToggleSelect} onSetCover={onSetCover} onDelete={onDelete} />
        </div>
      )}
    </div>
  )
}

export function StudioEventView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const push = useToastStore((s) => s.push)
  const { data: event, isLoading } = useEvent(id)
  const { data: photos = [] } = useEventPhotosDetailed(id)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [moveTarget, setMoveTarget] = useState('')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > HEADER_SCROLL_THRESHOLD)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const photosByPoint = useMemo(() => {
    const map = new Map<string, EventPhoto[]>()
    for (const p of photos) {
      const key = p.point_id ?? '__none__'
      const list = map.get(key) ?? []
      list.push(p)
      map.set(key, list)
    }
    return map
  }, [photos])

  function toggleSelect(photoId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(photoId)) next.delete(photoId)
      else next.add(photoId)
      return next
    })
  }

  function invalidatePhotos() {
    queryClient.invalidateQueries({ queryKey: ['event-photos-detailed', id] })
    queryClient.invalidateQueries({ queryKey: ['my-events', user?.id] })
  }

  async function deletePhoto(photoId: string) {
    const ok = await confirmDialog.ask({ title: '¿Eliminar esta foto?', confirmLabel: 'Eliminar', tone: 'danger' })
    if (!ok) return
    const { error } = await supabase.from('photos').delete().eq('id', photoId)
    if (error) {
      if (error.code === '23503') {
        push({ type: 'error', title: 'No se puede eliminar', description: 'Esta foto ya fue vendida.' })
      } else {
        push({ type: 'error', title: 'No se pudo eliminar', description: error.message })
      }
      return
    }
    push({ type: 'success', title: 'Foto eliminada' })
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(photoId)
      return next
    })
    invalidatePhotos()
  }

  async function setCoverPhoto(photoId: string) {
    if (!event) return
    push({ type: 'info', title: 'Preparando portada…' })
    const { data, error } = await supabase.functions.invoke('r2-set-event-cover', { body: { photoId, eventId: event.id } })
    if (error || !data?.coverPath) {
      push({ type: 'error', title: 'No se pudo usar como portada', description: error?.message })
      return
    }
    const { error: updateError } = await supabase.from('events').update({ cover_path: data.coverPath }).eq('id', event.id)
    if (updateError) {
      push({ type: 'error', title: 'No se pudo guardar la portada', description: updateError.message })
      return
    }
    push({ type: 'success', title: 'Portada del evento actualizada' })
    queryClient.invalidateQueries({ queryKey: ['event', id] })
    queryClient.invalidateQueries({ queryKey: ['my-events', user?.id] })
    queryClient.invalidateQueries({ queryKey: ['public-events'] })
  }

  async function bulkSetCover() {
    const first = Array.from(selectedIds)[0]
    if (!first) return
    await setCoverPhoto(first)
    setSelectedIds(new Set())
  }

  async function bulkMoveTo(pointId: string) {
    if (!pointId) return
    const ids = Array.from(selectedIds)
    const { error } = await supabase.from('photos').update({ point_id: pointId === '__none__' ? null : pointId }).in('id', ids)
    if (error) {
      push({ type: 'error', title: 'No se pudo mover', description: error.message })
      return
    }
    push({ type: 'success', title: `${ids.length} foto${ids.length > 1 ? 's' : ''} movida${ids.length > 1 ? 's' : ''}` })
    setSelectedIds(new Set())
    setMoveTarget('')
    invalidatePhotos()
  }

  async function bulkDelete() {
    const ids = Array.from(selectedIds)
    const ok = await confirmDialog.ask({
      title: `¿Eliminar ${ids.length} foto${ids.length > 1 ? 's' : ''}?`,
      description: 'Las que ya se vendieron no se pueden borrar y se conservan intactas.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!ok) return
    const { error } = await supabase.from('photos').delete().in('id', ids)
    if (error) {
      push({ type: 'error', title: 'No se pudieron eliminar todas', description: error.message })
    } else {
      push({ type: 'success', title: 'Fotos eliminadas' })
    }
    setSelectedIds(new Set())
    invalidatePhotos()
  }

  async function toggleStatus(next: EventStatus) {
    const { error } = await supabase.from('events').update({ status: next }).eq('id', id)
    if (error) {
      push({ type: 'error', title: 'No se pudo actualizar', description: error.message })
      return
    }
    push({ type: 'success', title: next === 'pausado' ? 'Evento pausado — oculto del público' : 'Evento publicado' })
    queryClient.invalidateQueries({ queryKey: ['event', id] })
    queryClient.invalidateQueries({ queryKey: ['my-events', user?.id] })
  }

  async function deleteEvent() {
    if (!event) return
    const ok = await typedConfirmDialog.ask({
      title: `Esto elimina "${event.title}" por completo, incluyendo todas sus fotos (vendidas o no).`,
      description: 'Los bikers que ya compraron fotos de este evento conservan su entrega — esto no les quita nada.',
      matchText: event.title,
      confirmLabel: 'Eliminar evento',
    })
    if (!ok) return
    const { error } = await supabase.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', event.id)
    if (error) {
      push({ type: 'error', title: 'No se pudo eliminar', description: error.message })
      return
    }
    push({ type: 'success', title: 'Evento eliminado' })
    queryClient.invalidateQueries({ queryKey: ['my-events', user?.id] })
    navigate('/studio/eventos')
  }

  if (isLoading) {
    return (
      <div>
        <div className="h-[360px] w-full animate-pulse bg-muted md:h-[420px]" />
        <div className={STUDIO_PAGE_WIDE}>
          <Skeleton className="mt-6 h-6 w-72" />
          <div className="mt-8 flex flex-col gap-3">
            <Skeleton className="h-24 w-full rounded-3xl" />
            <Skeleton className="h-24 w-full rounded-3xl" />
            <Skeleton className="h-24 w-full rounded-3xl" />
          </div>
        </div>
      </div>
    )
  }
  if (!event) return <PlaceholderPage title="Evento no encontrado" />

  const statusStyle = EVENT_STATUS_STYLE[event.status]
  const unassigned = photosByPoint.get('__none__') ?? []
  const coverUrl = event.cover_path ? r2Url(event.cover_path) : null

  return (
    <>
      {coverUrl ? (
        <ScrollExpand
          src={coverUrl}
          alt={event.title}
          title={event.title}
          scrollHint="Desliza para ver el evento"
          useWindowScroll
          startRadius={0}
          endRadius={0}
          mediaZoom={1.12}
          scrollDistance={0.35}
          holdDistance={0.05}
        />
      ) : (
        <div className="relative flex h-[280px] w-full items-center justify-center overflow-hidden bg-muted md:h-[380px]">
          <span className="text-5xl opacity-20">📷</span>
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 to-transparent" />
        </div>
      )}

      <div className={STUDIO_PAGE_WIDE}>
        <Link
          to="/studio/eventos"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <span aria-hidden>←</span> Volver a eventos
        </Link>

        <div className={cn('sticky z-20 mt-6 top-[4.75rem] md:top-[5.5rem]')}>
          <div
            className={cn(
              'rounded-3xl border border-border bg-background/95 shadow-sm backdrop-blur-md transition-all duration-300',
              scrolled ? 'px-4 py-2.5' : 'px-5 py-5 sm:px-6',
            )}
          >
            <div className="flex items-center gap-4">
              <div className={cn('shrink-0 overflow-hidden rounded-2xl bg-muted transition-all duration-300', scrolled ? 'h-10 w-10' : 'h-16 w-16')}>
                {coverUrl ? <img src={coverUrl} alt="" className="h-full w-full object-cover" /> : (
                  <div className="flex h-full w-full items-center justify-center text-lg opacity-30">📷</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill dot={statusStyle.dot} text={statusStyle.text} label={statusStyle.label} className="shrink-0 text-[10px] uppercase tracking-wide" />
                  <h1 className={cn('truncate font-studio font-bold tracking-tight2 transition-all duration-300', scrolled ? 'text-base' : 'text-2xl md:text-3xl')}>
                    {event.title}
                  </h1>
                </div>
                {!scrolled && (
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {event.city}
                    {event.venue ? ` · ${event.venue}` : ''} · {new Date(event.event_date).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {event.status === 'pausado' ? (
                  <button
                    onClick={() => toggleStatus('activo')}
                    className={cn('rounded-full bg-emerald-600 font-bold text-white transition-colors hover:bg-emerald-500', scrolled ? 'px-3 py-2 text-[11px]' : 'px-5 py-2.5 text-xs')}
                  >
                    Publicar
                  </button>
                ) : (
                  <button
                    onClick={() => toggleStatus('pausado')}
                    className={cn('rounded-full bg-blue-600 font-bold text-white transition-colors hover:bg-blue-500', scrolled ? 'px-3 py-2 text-[11px]' : 'px-5 py-2.5 text-xs')}
                  >
                    Pausar
                  </button>
                )}
                <Link
                  to={`/studio/eventos/${id}/editar`}
                  className={cn(
                    'flex items-center justify-center rounded-full border border-border font-semibold transition-colors hover:bg-muted',
                    scrolled ? 'h-9 w-9' : 'px-5 py-2.5 text-sm',
                  )}
                  title="Editar evento"
                >
                  {scrolled ? '✎' : 'Editar evento'}
                </Link>
                <button
                  onClick={deleteEvent}
                  aria-label="Eliminar evento"
                  title="Eliminar evento"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-accent transition-colors hover:border-accent hover:bg-accent hover:text-accent-foreground"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!scrolled && (
              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
                <div>
                  <p className="font-studio text-xl font-bold">Q{event.price_per_photo}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Por foto</p>
                </div>
                <div>
                  <p className="font-studio text-xl font-bold">{event.event_points.length}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Puntos</p>
                </div>
                <div>
                  <p className="font-studio text-xl font-bold">{photos.length}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fotos</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {event.description && <p className="mt-6 max-w-2xl text-muted-foreground">{event.description}</p>}

        <div className="mt-10 flex flex-col gap-4 pb-24">
          {event.event_points.map((pt) => (
            <PointCard
              key={pt.id}
              point={pt}
              photos={photosByPoint.get(pt.id) ?? []}
              eventId={event.id}
              photographerId={event.photographer_id}
              price={event.price_per_photo}
              watermarkPath={event.watermark_path}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onSetCover={setCoverPhoto}
              onDelete={deletePhoto}
              onUploaded={invalidatePhotos}
            />
          ))}

          {unassigned.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-border bg-card p-5">
              <h2 className="mb-4 font-studio text-lg font-bold tracking-tight2">Sin punto asignado</h2>
              <PhotoGallery photos={unassigned} selectedIds={selectedIds} onToggleSelect={toggleSelect} onSetCover={setCoverPhoto} onDelete={deletePhoto} />
            </div>
          )}

          {event.event_points.length === 0 && (
            <p className="text-muted-foreground">
              Este evento no tiene puntos de cobertura todavía —{' '}
              <Link to={`/studio/eventos/${id}/editar`} className="text-accent underline">agrégalos editando el evento</Link>.
            </p>
          )}
        </div>
      </div>

      <ScrollToTopButton />

      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
          <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-border bg-background px-5 py-3 shadow-lg">
            <span className="text-sm font-semibold">{selectedIds.size} seleccionada{selectedIds.size > 1 ? 's' : ''}</span>
            <button onClick={bulkSetCover} className="rounded-full bg-muted px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-border">
              ★ Portada
            </button>
            <select
              value={moveTarget}
              onChange={(e) => {
                setMoveTarget(e.target.value)
                bulkMoveTo(e.target.value)
              }}
              className="rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold outline-none"
            >
              <option value="">Mover a…</option>
              {event.event_points.map((pt) => (
                <option key={pt.id} value={pt.id}>{pt.label}</option>
              ))}
              <option value="__none__">Sin punto asignado</option>
            </select>
            <button onClick={bulkDelete} className="rounded-full bg-foreground px-3.5 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90">
              Eliminar
            </button>
            <button onClick={() => setSelectedIds(new Set())} aria-label="Cancelar selección" className="ml-1 text-muted-foreground hover:text-foreground">
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  )
}
