import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { groupByDeclaredSegments, type ManualSegment } from './photoGrouping'
import { statsFor, rawIds, type StorageStats, type PhotoRow } from './useStorageOverview'

export interface EventPhotoRow extends PhotoRow {
  original_filename: string | null
  preview_path: string | null
  thumbnail_path: string | null
}

export interface EventHorarioNode extends StorageStats {
  key: string
  start: string
  end: string
  photos: EventPhotoRow[]
  rawPhotoIds: string[]
}

export interface EventLeftoverNode extends StorageStats {
  photos: EventPhotoRow[]
  rawPhotoIds: string[]
}

export interface EventPointNode extends StorageStats {
  /** `null` = pseudo-punto "Sin punto asignado". */
  id: string | null
  label: string
  photos: EventPhotoRow[]
  rawPhotoIds: string[]
  manualSegments: ManualSegment[]
  horarios: EventHorarioNode[]
  leftover: EventLeftoverNode | null
}

export interface EventFeaturedNode extends StorageStats {
  photos: EventPhotoRow[]
  rawPhotoIds: string[]
}

function buildEventPoint(id: string | null, label: string, manualSegments: ManualSegment[] | null, ptPhotos: EventPhotoRow[]): EventPointNode {
  const segments = manualSegments ?? []
  let horarios: EventHorarioNode[] = []
  let leftover: EventLeftoverNode | null = null

  if (segments.length > 0) {
    const { buckets, leftover: leftoverPhotos } = groupByDeclaredSegments(ptPhotos, segments)
    horarios = buckets.map((b) => ({
      key: `${id ?? 'sin-punto'}:${b.start}-${b.end}`,
      start: b.start,
      end: b.end,
      photos: b.photos,
      rawPhotoIds: rawIds(b.photos),
      ...statsFor(b.photos),
    }))
    leftover = { photos: leftoverPhotos, rawPhotoIds: rawIds(leftoverPhotos), ...statsFor(leftoverPhotos) }
  }

  return {
    id,
    label,
    photos: ptPhotos,
    rawPhotoIds: rawIds(ptPhotos),
    manualSegments: segments,
    horarios,
    leftover,
    ...statsFor(ptPhotos),
  }
}

/** Mismo árbol Punto → Horario que `useStorageOverview.ts` (evento/punto/
 * horario, misma agregación reusada de ahí), pero acotado a UN evento — el
 * mismo administrador de almacenamiento, ahora embebido en el editor del
 * evento en vez de solo en la pantalla de Almacenamiento. Además separa las
 * fotos destacadas (`featured = true`, siempre `point_id null`) en su
 * propio nodo en vez de dejarlas colarse en "Sin punto asignado". */
export function useEventStorageTree(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-storage-tree', eventId],
    queryFn: async (): Promise<{ points: EventPointNode[]; featured: EventFeaturedNode }> => {
      const [{ data: points, error: pointsError }, { data: photos, error: photosError }] = await Promise.all([
        supabase.from('event_points').select('id, label, manual_segments').eq('event_id', eventId),
        supabase
          .from('photos')
          .select('id, event_id, point_id, captured_at, delivered_path, raw_path, preview_path, thumbnail_path, preview_size_bytes, raw_size_bytes, delivered_size_bytes, original_filename, featured')
          .eq('event_id', eventId),
      ])
      if (pointsError) throw pointsError
      if (photosError) throw photosError

      const allPhotos = (photos ?? []) as (EventPhotoRow & { featured: boolean })[]
      const featuredPhotos = allPhotos.filter((p) => p.featured)
      const regularPhotos = allPhotos.filter((p) => !p.featured)

      const photosByPoint = new Map<string, EventPhotoRow[]>()
      const unassigned: EventPhotoRow[] = []
      for (const photo of regularPhotos) {
        if (photo.point_id) {
          const list = photosByPoint.get(photo.point_id) ?? []
          list.push(photo)
          photosByPoint.set(photo.point_id, list)
        } else {
          unassigned.push(photo)
        }
      }

      const pointNodes: EventPointNode[] = (points ?? []).map((pt) =>
        buildEventPoint(pt.id, pt.label, pt.manual_segments, photosByPoint.get(pt.id) ?? []),
      )
      if (unassigned.length > 0) {
        pointNodes.push(buildEventPoint(null, 'Sin punto asignado', null, unassigned))
      }

      return {
        points: pointNodes,
        featured: { photos: featuredPhotos, rawPhotoIds: rawIds(featuredPhotos), ...statsFor(featuredPhotos) },
      }
    },
    enabled: !!eventId && eventId !== 'new',
  })
}
