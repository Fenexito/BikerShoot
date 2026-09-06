import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { uploadWithProgress, createFullQualityPreview } from './photoUpload'
import { useToastStore } from '../../ui/overlays/toastStore'
import { confirmDialog } from '../../ui/overlays/confirmStore'

export const MAX_FEATURED = 30

export interface FeaturedPhoto {
  id: string
  preview_path: string | null
  storage_path: string | null
}

export function useEventFeaturedPhotos(eventId: string | undefined) {
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

export interface FeaturedQueueItem {
  id: string
  file: File
  localPreview: string
  status: 'subiendo' | 'error'
  progress: number
  errorMessage?: string
}

/** Lógica compartida de subida/borrado de fotos destacadas — usada tanto
 * por el editor del evento (grid simple con progreso) como por la sección
 * "Destacadas" del visor del evento (galería de acordeón). Un solo lugar
 * para el pipeline de subida en alta calidad sin marca de agua. */
export function useFeaturedPhotosManager(eventId: string, photographerId: string) {
  const push = useToastStore((s) => s.push)
  const { data: existing = [] } = useEventFeaturedPhotos(eventId)
  const [queue, setQueue] = useState<FeaturedQueueItem[]>([])

  const usedSlots = existing.length + queue.length
  const remaining = Math.max(0, MAX_FEATURED - usedSlots)

  async function uploadOne(item: FeaturedQueueItem) {
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
    const items: FeaturedQueueItem[] = toAdd.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      localPreview: URL.createObjectURL(file),
      status: 'subiendo',
      progress: 0,
    }))
    setQueue((q) => [...q, ...items])
    items.forEach(uploadOne)
  }

  function retry(item: FeaturedQueueItem) {
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

  return { existing, queue, usedSlots, remaining, enqueue, retry, removeExisting }
}
