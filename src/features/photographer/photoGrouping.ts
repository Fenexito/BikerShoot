export interface ManualSegment {
  start: string
  end: string
}

interface WithCapturedAt {
  captured_at: string | null
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
    const t = photo.captured_at ? new Date(photo.captured_at).toISOString().slice(11, 16) : null
    const bucket = t ? buckets.find((b) => t >= b.start && t < b.end) : undefined
    if (bucket) bucket.photos.push(photo)
    else leftover.push(photo)
  }
  return { buckets, leftover }
}
