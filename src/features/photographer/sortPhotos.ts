/** Orden alfabético (numérico-aware) por nombre de archivo original — el
 * fotógrafo depende del correlativo de su cámara para saber la secuencia
 * real, así que las galerías por punto SIEMPRE deben verse en este orden,
 * nunca por hora de subida (que puede variar según cómo se arrastraron los
 * archivos al navegador). */
export function sortPhotosByFilename<T extends { original_filename: string | null }>(photos: T[]): T[] {
  return [...photos].sort((a, b) =>
    (a.original_filename ?? '').localeCompare(b.original_filename ?? '', undefined, { numeric: true, sensitivity: 'base' }),
  )
}
