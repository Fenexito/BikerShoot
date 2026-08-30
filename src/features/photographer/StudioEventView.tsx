import { useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useEvent, useEventPhotosDetailed, type EventPhoto } from './useMyEvents'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { r2Url, previewUrl } from '../../lib/r2'
import { uploadWithProgress, loadWatermarkImage, createWatermarkedPreview } from './photoUpload'
import { Badge } from '../../ui/studio/Badge'
import { Button } from '../../ui/studio/Button'
import { useToastStore } from '../../ui/overlays/toastStore'
import { PlaceholderPage } from '../auth/PlaceholderPage'
import { cn } from '../../lib/cn'

function PointUploader({
  eventId,
  photographerId,
  pointId,
  price,
  watermarkPath,
}: {
  eventId: string
  photographerId: string
  pointId: string | null
  price: number
  watermarkPath: string | null
}) {
  const push = useToastStore((s) => s.push)
  const inputRef = useRef<HTMLInputElement>(null)
  const [backupRaw, setBackupRaw] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    setUploading(true)
    setProgress({ done: 0, total: imageFiles.length })

    let watermarkImage: ImageBitmap | null = null
    if (watermarkPath) {
      try {
        watermarkImage = await loadWatermarkImage(r2Url(watermarkPath))
      } catch {
        push({ type: 'error', title: 'No se pudo cargar la marca de agua del evento' })
      }
    }

    let failures = 0
    await Promise.all(
      imageFiles.map(async (file) => {
        try {
          const { data, error } = await supabase.functions.invoke('r2-upload-url', {
            body: { fileName: file.name, contentType: file.type, eventId, includeRaw: backupRaw },
          })
          if (error || !data?.previewUploadUrl) throw new Error(error?.message ?? 'No se pudo obtener la URL de subida')

          const previewBlob = await createWatermarkedPreview(file, watermarkImage)

          const uploads = [uploadWithProgress(data.previewUploadUrl, previewBlob, 'image/jpeg', () => {})]
          if (backupRaw && data.rawUploadUrl) uploads.push(uploadWithProgress(data.rawUploadUrl, file, file.type, () => {}))
          await Promise.all(uploads)

          const { error: insertError } = await supabase.from('photos').insert({
            event_id: eventId,
            photographer_id: photographerId,
            point_id: pointId,
            preview_path: data.previewPath,
            raw_path: backupRaw ? data.rawPath : null,
            price,
            size_bytes: previewBlob.size + (backupRaw ? file.size : 0),
          })
          if (insertError) throw insertError
        } catch {
          failures++
        } finally {
          setProgress((p) => ({ ...p, done: p.done + 1 }))
        }
      }),
    )

    setUploading(false)
    if (failures > 0) {
      push({ type: 'error', title: `${failures} foto(s) fallaron`, description: 'Vuelve a intentarlo con esos archivos.' })
    } else {
      push({ type: 'success', title: `${imageFiles.length} foto(s) subidas` })
    }
    queryClient.invalidateQueries({ queryKey: ['event-photos-detailed', eventId] })
    queryClient.invalidateQueries({ queryKey: ['my-events', photographerId] })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="ghost" loading={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? `Subiendo ${progress.done}/${progress.total}…` : '+ Subir fotos a este punto'}
      </Button>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={backupRaw} onChange={(e) => setBackupRaw(e.target.checked)} className="h-3.5 w-3.5 accent-accent" />
        Respaldar original
      </label>
      <input ref={inputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
    </div>
  )
}

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

export function StudioEventView() {
  const { id } = useParams()
  const { user } = useAuth()
  const push = useToastStore((s) => s.push)
  const { data: event, isLoading } = useEvent(id)
  const { data: photos = [] } = useEventPhotosDetailed(id)

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
                <PointUploader eventId={event.id} photographerId={event.photographer_id} pointId={pt.id} price={event.price_per_photo} watermarkPath={event.watermark_path} />
              </div>
              {ptPhotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {ptPhotos.map((photo) => (
                    <PhotoTile key={photo.id} photo={photo} onDelete={deletePhoto} />
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
                <PhotoTile key={photo.id} photo={photo} onDelete={deletePhoto} />
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
