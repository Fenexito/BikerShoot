import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface PointStorage {
  id: string
  label: string
  totalPhotos: number
  soldPhotos: number
  bytes: number
}

export interface EventStorage {
  id: string
  title: string
  eventDate: string
  totalPhotos: number
  soldPhotos: number
  bytes: number
  points: PointStorage[]
}

interface PhotoRow {
  event_id: string
  point_id: string | null
  delivered_path: string | null
  preview_size_bytes: number | null
  raw_size_bytes: number | null
  delivered_size_bytes: number | null
}

function photoBytes(p: PhotoRow) {
  return (p.preview_size_bytes ?? 0) + (p.raw_size_bytes ?? 0) + (p.delivered_size_bytes ?? 0)
}

/** Uso de almacenamiento por evento y por punto — para la pantalla de
 * administrar almacenamiento. Trae eventos/puntos/fotos propios y agrega
 * en el cliente, mismo patrón que ya usa StoragePlansAdmin.tsx en admin. */
export function useStorageOverview(photographerId: string | undefined) {
  return useQuery({
    queryKey: ['storage-overview', photographerId],
    queryFn: async (): Promise<EventStorage[]> => {
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, title, event_date')
        .eq('photographer_id', photographerId)
        .is('deleted_at', null)
        .order('event_date', { ascending: true })
      if (eventsError) throw eventsError
      if (!events || events.length === 0) return []

      const eventIds = events.map((e) => e.id)

      const [{ data: points, error: pointsError }, { data: photos, error: photosError }] = await Promise.all([
        supabase.from('event_points').select('id, label, event_id').in('event_id', eventIds),
        supabase
          .from('photos')
          .select('event_id, point_id, delivered_path, preview_size_bytes, raw_size_bytes, delivered_size_bytes')
          .in('event_id', eventIds),
      ])
      if (pointsError) throw pointsError
      if (photosError) throw photosError

      const pointsByEvent = new Map<string, { id: string; label: string }[]>()
      for (const pt of points ?? []) {
        const list = pointsByEvent.get(pt.event_id) ?? []
        list.push({ id: pt.id, label: pt.label })
        pointsByEvent.set(pt.event_id, list)
      }

      const photosByPoint = new Map<string, PhotoRow[]>()
      const photosByEvent = new Map<string, PhotoRow[]>()
      for (const photo of (photos ?? []) as PhotoRow[]) {
        const eventList = photosByEvent.get(photo.event_id) ?? []
        eventList.push(photo)
        photosByEvent.set(photo.event_id, eventList)
        if (photo.point_id) {
          const pointList = photosByPoint.get(photo.point_id) ?? []
          pointList.push(photo)
          photosByPoint.set(photo.point_id, pointList)
        }
      }

      return events.map((event): EventStorage => {
        const eventPhotos = photosByEvent.get(event.id) ?? []
        const eventPoints = pointsByEvent.get(event.id) ?? []
        return {
          id: event.id,
          title: event.title,
          eventDate: event.event_date,
          totalPhotos: eventPhotos.length,
          soldPhotos: eventPhotos.filter((p) => p.delivered_path).length,
          bytes: eventPhotos.reduce((sum, p) => sum + photoBytes(p), 0),
          points: eventPoints.map((pt): PointStorage => {
            const ptPhotos = photosByPoint.get(pt.id) ?? []
            return {
              id: pt.id,
              label: pt.label,
              totalPhotos: ptPhotos.length,
              soldPhotos: ptPhotos.filter((p) => p.delivered_path).length,
              bytes: ptPhotos.reduce((sum, p) => sum + photoBytes(p), 0),
            }
          }),
        }
      })
    },
    enabled: !!photographerId,
  })
}
