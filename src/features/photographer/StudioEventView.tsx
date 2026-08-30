import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useEvent, useEventPhotosDetailed, type EventPhoto } from './useMyEvents'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { r2Url, previewUrl } from '../../lib/r2'
import { PhotoUploadQueue } from './components/PhotoUploadQueue'
import { Badge } from '../../ui/studio/Badge'
import { Button } from '../../ui/studio/Button'
import { useToastStore } from '../../ui/overlays/toastStore'
import { PlaceholderPage } from '../auth/PlaceholderPage'
import { cn } from '../../lib/cn'

function PhotoTile({ photo, onDelete, onToggleFeatured }: { photo: EventPhoto; onDelete: (id: string) => void; onToggleFeatured: (id: string, next: boolean) => void }) {
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
        onClick={() => onToggleFeatured(photo.id, !photo.featured)}
        aria-label="Destacar en tu perfil"
        title="Destacar en tu perfil"
        className={cn(
          'absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-sm transition-opacity',
          photo.featured ? 'bg-accent text-white opacity-100' : 'bg-black/60 text-white opacity-0 group-hover:opacity-100',
        )}
      >
        ★
      </button>
      <button
        onClick={() => onDelete(photo.id)}
        className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        Eliminar
      </button>
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
    if (!window.confirm('¿Eliminar esta foto?')) return
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

  async function toggleFeatured(photoId: string, next: boolean) {
    const { error } = await supabase.from('photos').update({ featured: next }).eq('id', photoId)
    if (error) {
      push({ type: 'error', title: 'No se pudo actualizar', description: error.message })
      return
    }
    queryClient.invalidateQueries({ queryKey: ['event-photos-detailed', id] })
  }

  if (isLoading) return <p className="px-6 py-16 text-center text-muted-foreground">Cargando evento…</p>
  if (!event) return <PlaceholderPage title="Evento no encontrado" />

  const isActive = event.status === 'activo'
  const unassigned = photosByPoint.get('__none__') ?? []

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 text-foreground md:px-16">
      <Link to="/studio/eventos" className="font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground hover:text-foreground">
        ← Todos tus eventos
      </Link>

      <div className="relative mt-6 flex h-48 items-center justify-center overflow-hidden border border-border bg-muted md:h-64">
        {event.cover_path ? (
          <img src={r2Url(event.cover_path)} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-4xl opacity-30">📷</span>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge>{event.category}</Badge>
            <span className={cn('flex items-center gap-1.5 font-studio-mono text-[10px] uppercase tracking-wider2', isActive ? 'text-emerald-500' : 'text-muted-foreground')}>
              <span className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'bg-emerald-500' : 'bg-muted-foreground')} />
              {isActive ? 'Activo' : 'Cerrado'}
            </span>
          </div>
          <h1 className="mt-2 font-studio text-3xl font-bold tracking-tight2 md:text-4xl">{event.title}</h1>
          <p className="mt-1 text-muted-foreground">
            {event.city}{event.venue ? ` · ${event.venue}` : ''} · {new Date(event.event_date).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link to={`/studio/eventos/${id}/editar`}>
          <Button variant="secondary">Editar evento</Button>
        </Link>
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
              {ptPhotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {ptPhotos.map((photo) => (
                    <PhotoTile key={photo.id} photo={photo} onDelete={deletePhoto} onToggleFeatured={toggleFeatured} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Todavía no hay fotos en este punto.</p>
              )}
            </section>
          )
        })}

        {unassigned.length > 0 && (
          <section>
            <h2 className="mb-4 font-studio text-lg font-bold tracking-tight2">Sin punto asignado</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {unassigned.map((photo) => (
                <PhotoTile key={photo.id} photo={photo} onDelete={deletePhoto} onToggleFeatured={toggleFeatured} />
              ))}
            </div>
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
  )
}
