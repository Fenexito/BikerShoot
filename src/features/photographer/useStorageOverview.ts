import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { groupByDeclaredSegments, type ManualSegment } from './photoGrouping'

export interface StorageStats {
  totalPhotos: number
  soldPhotos: number
  bytes: number
  soldBytes: number
  unsoldBytes: number
}

export interface HorarioStorage extends StorageStats {
  key: string
  start: string
  end: string
  /** IDs exactos de las fotos de este horario — la única forma de borrar,
   * mover o descargar a este nivel de detalle, ya que las funciones de
   * limpieza solo entienden `pointId`/`eventId` completos. */
  photoIds: string[]
  /** Subconjunto de `photoIds` que sí tiene respaldo crudo — para saber de
   * antemano cuántas fotos "Descargar" realmente podrá traer. */
  rawPhotoIds: string[]
}

/** Fotos de un punto que no calzan en ningún horario declarado (sin EXIF, o
 * fuera de cualquier rango) — mismo bucket "leftover" que ya usa
 * `EventImagesManager.tsx`, expuesto aquí como su propio nodo del árbol. */
export interface LeftoverStorage extends StorageStats {
  photoIds: string[]
  rawPhotoIds: string[]
}

export interface PointStorage extends StorageStats {
  /** `null` = pseudo-punto "Sin punto asignado" (fotos sueltas del evento). */
  id: string | null
  label: string
  photoIds: string[]
  rawPhotoIds: string[]
  manualSegments: ManualSegment[]
  /** Solo se llena si el punto declaró `manualSegments` — si no, las fotos
   * del punto se administran en bloque, sin bajar un nivel más. */
  horarios: HorarioStorage[]
  leftover: LeftoverStorage | null
}

export interface EventStorage extends StorageStats {
  id: string
  title: string
  eventDate: string
  photoIds: string[]
  rawPhotoIds: string[]
  points: PointStorage[]
}

export interface PhotoRow {
  id: string
  event_id: string
  point_id: string | null
  captured_at: string | null
  delivered_path: string | null
  raw_path: string | null
  preview_size_bytes: number | null
  raw_size_bytes: number | null
  delivered_size_bytes: number | null
}

/** Exportadas para que `useEventStorageTree.ts` (el mismo árbol pero
 * acotado a un solo evento, usado dentro del editor) arme sus nodos con la
 * misma lógica exacta en vez de duplicarla. */
export function photoBytes(p: PhotoRow) {
  return (p.preview_size_bytes ?? 0) + (p.raw_size_bytes ?? 0) + (p.delivered_size_bytes ?? 0)
}

export function statsFor(list: PhotoRow[]): StorageStats {
  const sold = list.filter((p) => p.delivered_path)
  const unsold = list.filter((p) => !p.delivered_path)
  return {
    totalPhotos: list.length,
    soldPhotos: sold.length,
    bytes: list.reduce((sum, p) => sum + photoBytes(p), 0),
    soldBytes: sold.reduce((sum, p) => sum + photoBytes(p), 0),
    unsoldBytes: unsold.reduce((sum, p) => sum + photoBytes(p), 0),
  }
}

export function rawIds(list: PhotoRow[]) {
  return list.filter((p) => p.raw_path).map((p) => p.id)
}

export function buildPoint(id: string | null, label: string, manualSegments: ManualSegment[] | null, ptPhotos: PhotoRow[]): PointStorage {
  const segments = manualSegments ?? []
  let horarios: HorarioStorage[] = []
  let leftover: LeftoverStorage | null = null

  if (segments.length > 0) {
    const { buckets, leftover: leftoverPhotos } = groupByDeclaredSegments(ptPhotos, segments)
    horarios = buckets.map((b) => ({
      key: `${id ?? 'sin-punto'}:${b.start}-${b.end}`,
      start: b.start,
      end: b.end,
      photoIds: b.photos.map((p) => p.id),
      rawPhotoIds: rawIds(b.photos),
      ...statsFor(b.photos),
    }))
    leftover = {
      photoIds: leftoverPhotos.map((p) => p.id),
      rawPhotoIds: rawIds(leftoverPhotos),
      ...statsFor(leftoverPhotos),
    }
  }

  return {
    id,
    label,
    photoIds: ptPhotos.map((p) => p.id),
    rawPhotoIds: rawIds(ptPhotos),
    manualSegments: segments,
    horarios,
    leftover,
    ...statsFor(ptPhotos),
  }
}

/** Uso de almacenamiento por evento, punto y horario — para el explorador
 * jerárquico de la pantalla de Almacenamiento. Trae eventos/puntos/fotos
 * propios y agrega en el cliente; reusa `groupByDeclaredSegments` (mismo
 * algoritmo que ya clasifica fotos por horario en `EventImagesManager.tsx`
 * y `StudioEventView.tsx`) para no duplicar esa lógica con otro criterio. */
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
        supabase.from('event_points').select('id, label, event_id, manual_segments').in('event_id', eventIds),
        supabase
          .from('photos')
          .select('id, event_id, point_id, captured_at, delivered_path, raw_path, preview_size_bytes, raw_size_bytes, delivered_size_bytes')
          .in('event_id', eventIds),
      ])
      if (pointsError) throw pointsError
      if (photosError) throw photosError

      const pointsByEvent = new Map<string, { id: string; label: string; manual_segments: ManualSegment[] | null }[]>()
      for (const pt of points ?? []) {
        const list = pointsByEvent.get(pt.event_id) ?? []
        list.push({ id: pt.id, label: pt.label, manual_segments: pt.manual_segments })
        pointsByEvent.set(pt.event_id, list)
      }

      const photosByEvent = new Map<string, PhotoRow[]>()
      const photosByPoint = new Map<string, PhotoRow[]>()
      const unassignedByEvent = new Map<string, PhotoRow[]>()
      for (const photo of (photos ?? []) as PhotoRow[]) {
        const eventList = photosByEvent.get(photo.event_id) ?? []
        eventList.push(photo)
        photosByEvent.set(photo.event_id, eventList)
        if (photo.point_id) {
          const pointList = photosByPoint.get(photo.point_id) ?? []
          pointList.push(photo)
          photosByPoint.set(photo.point_id, pointList)
        } else {
          const list = unassignedByEvent.get(photo.event_id) ?? []
          list.push(photo)
          unassignedByEvent.set(photo.event_id, list)
        }
      }

      return events.map((event): EventStorage => {
        const eventPhotos = photosByEvent.get(event.id) ?? []
        const eventPoints = pointsByEvent.get(event.id) ?? []

        const points: PointStorage[] = eventPoints.map((pt) =>
          buildPoint(pt.id, pt.label, pt.manual_segments, photosByPoint.get(pt.id) ?? []),
        )

        const unassigned = unassignedByEvent.get(event.id) ?? []
        if (unassigned.length > 0) {
          points.push(buildPoint(null, 'Sin punto asignado', null, unassigned))
        }

        return {
          id: event.id,
          title: event.title,
          eventDate: event.event_date,
          photoIds: eventPhotos.map((p) => p.id),
          rawPhotoIds: rawIds(eventPhotos),
          points,
          ...statsFor(eventPhotos),
        }
      })
    },
    enabled: !!photographerId,
  })
}
