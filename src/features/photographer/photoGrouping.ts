export interface ManualSegment {
  start: string
  end: string
}

interface WithCapturedAt {
  captured_at: string | null
}

/** Hora local (no UTC) de un `captured_at` — los horarios declarados por el
 * fotógrafo (`event_points.manual_segments`) están en hora local del evento,
 * y tanto `extractCapturedAt` (EXIF) como el asignado manual/forzado
 * construyen el `Date` a partir de componentes locales, así que leerlo de
 * vuelta también debe ser local. Usar `.toISOString()` aquí (UTC) desalinea
 * la comparación por el offset de zona horaria y la foto nunca calza con
 * ningún bloque declarado — este fue exactamente el bug reportado de
 * "asigné hora pero la foto no se movió". */
function localHHMM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Agrupa por los horarios que el fotógrafo ya declaró a mano (Ruta tab) —
 * una foto cae en el rango cuya hora de captura contiene (solo hora:minuto,
 * sin importar la fecha exacta); lo que no calza (sin EXIF, o fuera de
 * cualquier horario declarado) cae en "leftover". Compartido entre el
 * editor y el visor del evento para que ambos categoricen exactamente igual. */
export function groupByDeclaredSegments<T extends WithCapturedAt>(photos: T[], segments: ManualSegment[]) {
  const buckets = segments.map((seg) => ({ ...seg, photos: [] as T[] }))
  const leftover: T[] = []
  for (const photo of photos) {
    const t = photo.captured_at ? localHHMM(photo.captured_at) : null
    const bucket = t ? buckets.find((b) => t >= b.start && t < b.end) : undefined
    if (bucket) bucket.photos.push(photo)
    else leftover.push(photo)
  }
  return { buckets, leftover }
}
