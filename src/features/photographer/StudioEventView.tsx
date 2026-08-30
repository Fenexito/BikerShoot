import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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
import { PlaceholderPage } from '../auth/PlaceholderPage'
import { cn } from '../../lib/cn'
import type { EventStatus } from '../../types/db'

const PAGE_SIZE = 12

function PhotoTile({ photo, onDelete }: { photo: EventPhoto; onDelete: (id: string) => void }) {
  const sold = !!photo.delivered_path
  return (
    <div className="group relative aspect-[4/5] overflow-hidden border border-border">
      <img src={previewUrl(photo)} alt="" className="h-full w-full object-cover" />
      {sold && (
        <span className="absolute left-1 top-1 bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
          Vendida
        </span>
      )}
      <button
        onClick={() => onDelete(photo.id)}
        className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        Eliminar
      </button>
    </div>
  )
}

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

function PhotoGallery({ photos, onDelete }: { photos: EventPhoto[]; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const visible = expanded ? photos : photos.slice(0, PAGE_SIZE)

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
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {visible.map((photo) => (
            <PhotoTile key={photo.id} photo={photo} onDelete={onDelete} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border border border-border">
          {visible.map((photo) => (
            <PhotoListRow key={photo.id} photo={photo} onDelete={onDelete} />
          ))}
        </div>
      )}

      {!expanded && photos.length > PAGE_SIZE && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-4 w-full border border-border py-3 text-center text-xs font-semibold uppercase tracking-wider2 text-muted-foreground hover:text-foreground"
        >
          Ver todas las fotos ({photos.length})
        </button>
      )}
    </div>
  )
}

export function StudioEventView() {
  const { id } = useParams()
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

  if (isLoading) return <p className="px-6 py-16 text-center text-muted-foreground">Cargando evento…</p>
  if (!event) return <PlaceholderPage title="Evento no encontrado" />

  const statusStyle = EVENT_STATUS_STYLE[event.status]
  const unassigned = photosByPoint.get('__none__') ?? []

  return (
    <>
      <div className="relative h-[280px] w-full overflow-hidden bg-muted md:h-[380px]">
        {event.cover_path ? (
          <img src={r2Url(event.cover_path)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl opacity-20">📷</div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 md:bottom-10 md:left-16 md:right-16">
          <Badge>{event.category}</Badge>
          <h1 className="mt-3 font-studio text-3xl font-bold tracking-tight2 text-white drop-shadow md:text-6xl">{event.title}</h1>
        </div>
      </div>

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
              <Button variant="ghost" onClick={() => toggleStatus('activo')}>Publicar</Button>
            ) : (
              <Button variant="ghost" onClick={() => toggleStatus('pausado')}>Pausar</Button>
            )}
            <Link to={`/studio/eventos/${id}/editar`}>
              <Button variant="secondary">Editar evento</Button>
            </Link>
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
