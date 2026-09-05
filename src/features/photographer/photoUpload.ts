// Lógica compartida de subida de fotos — usada por la carga por punto
// dentro del visor y del editor de un evento. Un solo lugar para el
// pipeline de reescalado + marca de agua y la subida con progreso a R2.

export const PREVIEW_MAX_SIDE = 1600
export const PREVIEW_QUALITY = 0.5

// Fotos destacadas: portafolio del fotógrafo, no están a la venta y nunca
// llevan marca de agua — se suben en calidad alta (Full HD) en vez de la
// calidad reducida de las fotos normales del evento.
export const FEATURED_MAX_SIDE = 1920
export const FEATURED_QUALITY = 0.92

export function uploadWithProgress(url: string, body: Blob, contentType: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100)
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 respondió ${xhr.status}`)))
    xhr.onerror = () => reject(new Error('Error de red subiendo a R2'))
    xhr.send(body)
  })
}

/** Hash SHA-256 del archivo original (bytes, no del preview reescalado) —
 * base del validador de duplicados: dos archivos con contenido idéntico dan
 * el mismo hash sin importar el nombre con el que se subieron. */
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function loadWatermarkImage(url: string): Promise<ImageBitmap> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('No se pudo cargar la marca de agua')
  const blob = await res.blob()
  return createImageBitmap(blob)
}

/** Reescala a máx. PREVIEW_MAX_SIDE (calidad reducida siempre) y, si el
 * evento tiene un PNG de marca de agua configurado, lo estampa en mosaico
 * diagonal sobre toda la foto — así se protege el original de ser
 * "robado" en alta calidad antes de la compra. Sin PNG, el preview sale
 * reducido igual pero sin nada encima. */
export async function createWatermarkedPreview(file: File, watermarkImage: ImageBitmap | null): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, PREVIEW_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar el lienzo del preview')
  ctx.drawImage(bitmap, 0, 0, width, height)

  if (watermarkImage) {
    ctx.save()
    ctx.globalAlpha = 0.45
    ctx.translate(width / 2, height / 2)
    ctx.rotate(-Math.PI / 8)
    ctx.translate(-width / 2, -height / 2)

    const wmWidth = width * 0.32
    const wmHeight = wmWidth * (watermarkImage.height / watermarkImage.width)
    const stepX = wmWidth * 1.6
    const stepY = wmHeight * 2.2

    for (let y = -height * 0.5; y < height * 1.5; y += stepY) {
      for (let x = -width * 0.5; x < width * 1.5; x += stepX) {
        ctx.drawImage(watermarkImage, x, y, wmWidth, wmHeight)
      }
    }
    ctx.restore()
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar el preview'))), 'image/jpeg', PREVIEW_QUALITY)
  })
}

/** Igual reescalado que `createWatermarkedPreview`, pero sin marca de agua y
 * en calidad alta — para fotos destacadas (portafolio, no vendibles). */
export async function createFullQualityPreview(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, FEATURED_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar el lienzo del preview')
  ctx.drawImage(bitmap, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar el preview'))), 'image/jpeg', FEATURED_QUALITY)
  })
}
