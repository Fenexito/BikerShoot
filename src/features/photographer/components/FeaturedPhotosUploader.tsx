import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { queryClient } from '../../../lib/queryClient'
import { previewUrl } from '../../../lib/r2'
import { uploadWithProgress, createFullQualityPreview } from '../photoUpload'
import { Button } from '../../../ui/studio/Button'
import { IconTrash } from '../../../ui/shared/icons'
import { useToastStore } from '../../../ui/overlays/toastStore'
import { confirmDialog } from '../../../ui/overlays/confirmStore'
import { cn } from '../../../lib/cn'

export const MAX_FEATURED = 30

interface FeaturedPhoto {
  id: string
  preview_path: string | null
  storage_path: string | null
}

function useEventFeaturedPhotos(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-featured-photos', eventId],
    queryFn: async (): Promise<FeaturedPhoto[]> => {
      const { data, error } = await supabase
        .from('photos')
        .select('id, preview_path, storage_path')
        .eq('event_id', eventId)
        .eq('featured', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!eventId && eventId !== 'new',
  })
}

interface QueueItem {
  id: string
  file: File
  localPreview: string
  status: 'subiendo' | 'error'
  progress: number
  errorMessage?: string
}

/** Fotos destacadas — el portafolio del fotógrafo, no fotos del punto de un
 * evento. Se suben aquí, en el editor (junto a portada/marca de agua), en
 * calidad alta y sin marca de agua: nunca están a la venta. Estas mismas
 * fotos alimentan la página del evento, el perfil público y el muro de
 * login — ver [[motoshots_v2_domain_mechanics]]. */
export function FeaturedPhotosUploader({ eventId, photographerId }: { eventId: string; photographerId: string }) {
  const push = useToastStore((s) => s.push)
  const { data: existing = [] } = useEventFeaturedPhotos(eventId)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const usedSlots = existing.length + queue.length
  const remaining = Math.max(0, MAX_FEATURED - usedSlots)

  async function uploadOne(item: QueueItem) {
    try {
      const { data, error } = await supabase.functions.invoke('r2-upload-url', {
        body: { fileName: item.file.name, contentType: item.file.type, eventId },
      })
      if (error || !data?.previewUploadUrl) throw new Error(error?.message ?? 'No se pudo obtener la URL de subida')

      const blob = await createFullQualityPreview(item.file)
      await uploadWithProgress(data.previewUploadUrl, blob, 'image/jpeg', (pct) =>
        setQueue((q) => q.map((i) => (i.id === item.id ? { ...i, progress: pct } : i))),
      )

      const { error: insertError } = await supabase.from('photos').insert({
        event_id: eventId,
        photographer_id: photographerId,
        point_id: null,
        preview_path: data.previewPath,
        price: 0,
        size_bytes: blob.size,
        preview_size_bytes: blob.size,
        raw_size_bytes: 0,
        original_filename: item.file.name,
        featured: true,
      })
      if (insertError) throw insertError

      setQueue((q) => q.filter((i) => i.id !== item.id))
      queryClient.invalidateQueries({ queryKey: ['event-featured-photos', eventId] })
      queryClient.invalidateQueries({ queryKey: ['featured-photographer-photos'] })
      queryClient.invalidateQueries({ queryKey: ['featured-event-photos'] })
    } catch (err) {
      setQueue((q) => q.map((i) => (i.id === item.id ? { ...i, status: 'error', errorMessage: (err as Error).message } : i)))
    }
  }

  function enqueue(files: FileList | null) {
    if (!files) return
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    const toAdd = imageFiles.slice(0, remaining)
    if (imageFiles.length > toAdd.length) {
      push({
        type: 'error',
        title: `Solo se agregaron ${toAdd.length} de ${imageFiles.length}`,
        description: `Máximo ${MAX_FEATURED} fotos destacadas por evento.`,
      })
    }
    const items: QueueItem[] = toAdd.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      localPreview: URL.createObjectURL(file),
      status: 'subiendo',
      progress: 0,
    }))
    setQueue((q) => [...q, ...items])
    items.forEach(uploadOne)
  }

  function retry(item: QueueItem) {
    setQueue((q) => q.map((i) => (i.id === item.id ? { ...i, status: 'subiendo', progress: 0, errorMessage: undefined } : i)))
    uploadOne(item)
  }

  async function removeExisting(photoId: string) {
    const ok = await confirmDialog.ask({ title: '¿Quitar esta foto destacada?', confirmLabel: 'Quitar', tone: 'danger' })
    if (!ok) return
    const { error } = await supabase.from('photos').delete().eq('id', photoId)
    if (error) {
      push({ type: 'error', title: 'No se pudo quitar', description: error.message })
      return
    }
    queryClient.invalidateQueries({ queryKey: ['event-featured-photos', eventId] })
    queryClient.invalidateQueries({ queryKey: ['featured-photographer-photos'] })
    queryClient.invalidateQueries({ queryKey: ['featured-event-photos'] })
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{usedSlots} / {MAX_FEATURED} fotos destacadas</p>
        <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={remaining === 0}>
          + Subir fotos destacadas
        </Button>
        <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => enqueue(e.target.files)} />
      </div>

      {existing.length === 0 && queue.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          Todavía no subes fotos destacadas para este evento.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {existing.map((photo) => (
            <div key={photo.id} className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-border">
              <img src={previewUrl(photo)} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => removeExisting(photo.id)}
                aria-label="Quitar foto destacada"
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <IconTrash className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {queue.map((item) => (
            <div key={item.id} className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-border">
              <img src={item.localPreview} alt="" className={cn('h-full w-full object-cover', item.status === 'error' && 'opacity-40')} />
              {item.status === 'subiendo' && (
                <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-1">
                  <div className="h-1 w-full bg-white/20">
                    <div className="h-full bg-accent transition-all" style={{ width: `${item.progress}%` }} />
                  </div>
                </div>
              )}
              {item.status === 'error' && (
                <button
                  onClick={() => retry(item)}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/80 p-2 text-center text-[10px] text-white"
                >
                  <span>{item.errorMessage ?? 'Error al subir'}</span>
                  <span className="font-bold uppercase tracking-wide text-accent">Reintentar</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
