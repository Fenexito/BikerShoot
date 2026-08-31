import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useEvent, useEventPhotosDetailed, type EventPhoto } from './useMyEvents'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { r2Url, previewUrl } from '../../lib/r2'
import { PhotoUploadQueue } from './components/PhotoUploadQueue'
import { EVENT_STATUS_STYLE } from '../../lib/eventStatus'
import { Badge } from '../../ui/studio/Badge'
import { Button } from '../../ui/studio/Button'
import { StatusPill } from '../../ui/shared/StatusPill'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { useToastStore } from '../../ui/overlays/toastStore'
import { confirmDialog } from '../../ui/overlays/confirmStore'
import { typedConfirmDialog } from '../../ui/overlays/typedConfirmStore'
import { PlaceholderPage } from '../auth/PlaceholderPage'
import { IconTrash } from '../../ui/shared/icons'
import ScrollExpand from '../../ui/reactbits/ScrollExpand'
import AccordionGallery from '../../ui/reactbits/AccordionGallery'
import { cn } from '../../lib/cn'
import type { EventStatus } from '../../types/db'

const PAGE_SIZE = 12

function PhotoListRow({ photo, onDelete }: { photo: EventPhoto; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <img src={previewUrl(photo)} alt="" className="h-12 w-12 shrink-0 border border-border object-cover" />
      <p className="min-w-0 flex-1 truncate text-sm" title={photo.original_filename ?? undefined}>
        {photo.original_filename ?? 'Sin nombre registrado'}
      </p>
      {photo.delivered_path && (
        <span className="shrink-0 bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Vendida</span>
      )}
      <button onClick={() => onDelete(photo.id)} className="shrink-0 text-xs font-semibold uppercase tracking-wider2 text-muted-foreground hover:text-accent">
        Eliminar
      </button>
    </div>
  )
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function AccordionRow({ photos, onDelete }: { photos: EventPhoto[]; onDelete: (id: string) => void }) {
  return (
    <AccordionGallery
      items={photos.map((photo) => ({
        image: previewUrl(photo),
        overlay: (
          <>
            {photo.delivered_path && (
              <span className="absolute left-2 top-2 bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                Vendida
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(photo.id) }}
              aria-label="Eliminar foto"
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center bg-black/70 text-white transition-colors hover:bg-accent"
            >
              <IconTrash className="h-3.5 w-3.5" />
            </button>
          </>
        ),
      }))}
      height={260}
      radius={0}
      expandRatio={0.3}
      tilt={6}
      parallax={0.3}
      accentColor="rgb(255 61 0)"
      overlayColor="#000000"
      showLabels={false}
      defaultIndex={0}
    />
  )
}

function PhotoGallery({ photos, onDelete }: { photos: EventPhoto[]; onDelete: (id: string) => void }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const visible = photos.slice(0, visibleCount)

  if (photos.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay fotos en este punto.</p>
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <div className="flex border border-border">
          <button
            onClick={() => setView('grid')}
            className={cn('px-2 py-1 text-[10px] uppercase tracking-wider2', view === 'grid' ? 'bg-foreground text-background' : 'text-muted-foreground')}
          >
            Grid
          </button>
          <button
            onClick={() => setView('list')}
            className={cn('px-2 py-1 text-[10px] uppercase tracking-wider2', view === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground')}
          >
            Lista
          </button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="flex flex-col gap-3">
          {chunk(visible, PAGE_SIZE).map((rowPhotos, i) => (
            <AccordionRow key={i} photos={rowPhotos} onDelete={onDelete} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border border border-border">
          {visible.map((photo) => (
            <PhotoListRow key={photo.id} photo={photo} onDelete={onDelete} />
          ))}
        </div>
      )}

      {visibleCount < photos.length && (
        <button
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="mt-4 w-full border border-border py-3 text-center text-xs font-semibold uppercase tracking-wider2 text-muted-foreground hover:text-foreground"
        >
          Ver más fotos ({photos.length - visibleCount} más)
        </button>
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
  const [uploadOpenFor, setUploadOpenFor] = useState<string | null>(null)

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
    queryClient.invalidateQueries({ queryKey: ['event-photos-detailed', id] })
    queryClient.invalidateQueries({ queryKey: ['my-events', user?.id] })
  }

  async function toggleStatus(next: EventStatus) {
    const { error } = await supabase.from('events').update({ status: next }).eq('id', id)
    if (error) {
      push({ type: 'error', title: 'No se pudo actualizar', description: error.message })
      return
    }
    push({
      type: 'success',
      title: next === 'pausado' ? 'Evento pausado — oculto del público' : 'Evento publicado',
    })
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

  if (isLoading) return <p className="px-6 py-16 text-center text-muted-foreground">Cargando evento…</p>
  if (!event) return <PlaceholderPage title="Evento no encontrado" />

  const statusStyle = EVENT_STATUS_STYLE[event.status]
  const unassigned = photosByPoint.get('__none__') ?? []

  return (
    <>
      {event.cover_path ? (
        <ScrollExpand
          src={r2Url(event.cover_path)}
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
          <div className="absolute bottom-6 left-6 right-6 md:bottom-10 md:left-16 md:right-16">
            <Badge className="border-white/20 bg-black/70 text-white">{event.category}</Badge>
            <h1 className="mt-3 font-studio text-3xl font-bold tracking-tight2 text-white drop-shadow md:text-6xl">{event.title}</h1>
          </div>
        </div>
      )}

      <div className={STUDIO_PAGE_WIDE}>
        <Link to="/studio/eventos" className="font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground hover:text-foreground">
          ← Todos tus eventos
        </Link>

        <div className="sticky top-16 z-20 mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-border bg-background py-4 -mx-6 px-6 md:-mx-16 md:px-16">
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill dot={statusStyle.dot} text={statusStyle.text} label={statusStyle.label} className="font-studio-mono text-[10px] uppercase tracking-wider2" />
            <p className="font-semibold">{event.title}</p>
            <p className="text-sm text-muted-foreground">
              {event.city}{event.venue ? ` · ${event.venue}` : ''} · {new Date(event.event_date).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex gap-2">
            {event.status === 'pausado' ? (
              <button
                onClick={() => toggleStatus('activo')}
                className="bg-emerald-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider2 text-white transition-colors hover:bg-emerald-500"
              >
                Publicar
              </button>
            ) : (
              <button
                onClick={() => toggleStatus('pausado')}
                className="bg-blue-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider2 text-white transition-colors hover:bg-blue-500"
              >
                Pausar
              </button>
            )}
            <Link to={`/studio/eventos/${id}/editar`}>
              <Button variant="secondary">Editar evento</Button>
            </Link>
            <button
              onClick={deleteEvent}
              aria-label="Eliminar evento"
              title="Eliminar evento"
              className="flex items-center justify-center border border-border px-3 text-accent transition-colors hover:border-accent hover:bg-accent hover:text-accent-foreground"
            >
              <IconTrash className="h-4 w-4" />
            </button>
          </div>
        </div>

        {event.description && <p className="mt-4 max-w-2xl text-muted-foreground">{event.description}</p>}

        <div className="mt-6 grid grid-cols-3 gap-3 border-y border-border py-5 text-center">
          <div>
            <p className="font-studio text-xl font-bold">Q{event.price_per_photo}</p>
            <p className="font-studio-mono text-[10px] uppercase text-muted-foreground">Por foto</p>
          </div>
          <div>
            <p className="font-studio text-xl font-bold">{event.event_points.length}</p>
            <p className="font-studio-mono text-[10px] uppercase text-muted-foreground">Puntos</p>
          </div>
          <div>
            <p className="font-studio text-xl font-bold">{photos.length}</p>
            <p className="font-studio-mono text-[10px] uppercase text-muted-foreground">Fotos</p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-10">
          {event.event_points.map((pt) => {
            const ptPhotos = photosByPoint.get(pt.id) ?? []
            return (
              <section key={pt.id}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-studio text-lg font-bold tracking-tight2">{pt.label}</h2>
                    <p className="font-studio-mono text-xs text-muted-foreground">
                      {pt.time_start.slice(0, 5)} – {pt.time_end.slice(0, 5)} · {ptPhotos.length} fotos
                    </p>
                  </div>
                  <Button variant="ghost" onClick={() => setUploadOpenFor(uploadOpenFor === pt.id ? null : pt.id)}>
                    {uploadOpenFor === pt.id ? 'Cerrar' : '+ Subir fotos a este punto'}
                  </Button>
                </div>
                {uploadOpenFor === pt.id && (
                  <div className="mb-6">
                    <PhotoUploadQueue
                      eventId={event.id}
                      pointId={pt.id}
                      photographerId={event.photographer_id}
                      price={event.price_per_photo}
                      watermarkPath={event.watermark_path}
                      onItemUploaded={() => {
                        queryClient.invalidateQueries({ queryKey: ['event-photos-detailed', id] })
                        queryClient.invalidateQueries({ queryKey: ['my-events', user?.id] })
                      }}
                    />
                  </div>
                )}
                <PhotoGallery photos={ptPhotos} onDelete={deletePhoto} />
              </section>
            )
          })}

          {unassigned.length > 0 && (
            <section>
              <h2 className="mb-4 font-studio text-lg font-bold tracking-tight2">Sin punto asignado</h2>
              <PhotoGallery photos={unassigned} onDelete={deletePhoto} />
            </section>
          )}

          {event.event_points.length === 0 && (
            <p className="text-muted-foreground">
              Este evento no tiene puntos de cobertura todavía —{' '}
              <Link to={`/studio/eventos/${id}/editar`} className="text-accent underline">agrégalos editando el evento</Link>.
            </p>
          )}
        </div>
      </div>
    </>
  )
}
