/** Clasificación automática de fotos de un punto en segmentos de tiempo —
 * reemplaza el mini-álbum manual que un fotógrafo arma hoy en Pixieset
 * (ej. "6:00-6:15", "6:15-6:30"...). Se calcula 100% en el cliente a partir
 * de `photos.captured_at` (EXIF DateTimeOriginal, ver photoUpload.ts) — no
 * requiere que el fotógrafo configure nada por adelantado.
 *
 * Regla: siempre arranca en bloques de 15 minutos; un bloque con pocas fotos
 * (menos que MIN_SEGMENT_PHOTOS) se fusiona con el bloque siguiente — así se
 * agrupa por volumen real de fotos, no por un tamaño fijo, tal como el
 * fotógrafo ya lo hace a mano hoy (junta 6:00-6:15 con 6:15-6:30 si cada uno
 * por separado tiene pocas fotos). */

const SLOT_MINUTES = 15
const MIN_SEGMENT_PHOTOS = 15

export interface SegmentablePhoto {
  id: string
  captured_at: string | null
}

export interface PhotoSegment<T extends SegmentablePhoto> {
  key: string
  label: string
  photos: T[]
}

function slotKey(date: Date) {
  const minutes = date.getHours() * 60 + date.getMinutes()
  const slot = Math.floor(minutes / SLOT_MINUTES) * SLOT_MINUTES
  return `${String(Math.floor(slot / 60)).padStart(2, '0')}:${String(slot % 60).padStart(2, '0')}`
}

function addMinutes(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(':').map(Number)
  const total = ((h * 60 + m + minutes) % (24 * 60) + 24 * 60) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const NO_TIME_KEY = '__sin_hora__'

/** Devuelve los segmentos de un punto, o `null` si no vale la pena
 * segmentar (ninguna foto trae `captured_at`, o todo cae en un solo bloque)
 * — en ese caso el llamador debe mostrar una sola galería plana, sin la capa
 * extra de "segmentos" encima. */
export function computeSegments<T extends SegmentablePhoto>(photos: T[]): PhotoSegment<T>[] | null {
  const withTime = photos.filter((p) => p.captured_at)
  if (withTime.length === 0) return null

  const slots = new Map<string, T[]>()
  const noTime: T[] = photos.filter((p) => !p.captured_at)
  for (const photo of withTime) {
    const key = slotKey(new Date(photo.captured_at!))
    const list = slots.get(key) ?? []
    list.push(photo)
    slots.set(key, list)
  }

  const orderedKeys = [...slots.keys()].sort()
  if (orderedKeys.length <= 1 && noTime.length === 0) return null

  // Fusiona bloques consecutivos de 15 min con pocas fotos entre sí.
  const merged: { start: string; slotCount: number; photos: T[] }[] = []
  for (const key of orderedKeys) {
    const list = slots.get(key)!
    const prev = merged[merged.length - 1]
    const prevEnd = prev ? addMinutes(prev.start, prev.slotCount * SLOT_MINUTES) : null
    if (prev && prev.photos.length < MIN_SEGMENT_PHOTOS && prevEnd === key) {
      prev.photos.push(...list)
      prev.slotCount += 1
    } else {
      merged.push({ start: key, slotCount: 1, photos: [...list] })
    }
  }

  const segments: PhotoSegment<T>[] = merged.map((m) => ({
    key: m.start,
    label: `${m.start} – ${addMinutes(m.start, m.slotCount * SLOT_MINUTES)}`,
    photos: m.photos,
  }))

  if (noTime.length > 0) {
    segments.push({ key: NO_TIME_KEY, label: 'Sin hora registrada', photos: noTime })
  }

  return segments
}
