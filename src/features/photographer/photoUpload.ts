// Lógica compartida de subida de fotos — usada por la carga por punto
// dentro del visor y del editor de un evento. Un solo lugar para el
// pipeline de reescalado + marca de agua y la subida con progreso a R2.
import { parse as parseExif, thumbnail as exifThumbnail } from 'exifr'
import { isRawFile } from '../../lib/rawImage'

export const PREVIEW_MAX_SIDE = 1600
export const PREVIEW_QUALITY = 0.5

export const LOCAL_THUMBNAIL_MAX_SIDE = 220

// Miniatura que SÍ se sube y persiste junto a la foto (a diferencia de
// LOCAL_THUMBNAIL_MAX_SIDE, que es solo para la cola local mientras se
// sube) — la usa el visor del evento para no tener que decodificar el
// preview completo (1600px) en cada tile de una grilla/acordeón con
// cientos de fotos.
export const GRID_THUMBNAIL_MAX_SIDE = 360
export const GRID_THUMBNAIL_QUALITY = 0.6

/** Decodifica un archivo a ImageBitmap para poder dibujarlo en canvas. Un
 * jpg/png/webp/heic lo decodifica el navegador directo. Un RAW (CR2/CR3/
 * NEF/ARW/...) el navegador NO lo puede decodificar — no hay soporte nativo
 * para el sensor crudo de cámara — así que en vez de eso se extrae la
 * miniatura JPEG que la propia cámara graba dentro del archivo (todas las
 * cámaras la generan para su pantalla LCD) y se decodifica esa. La
 * resolución de esa miniatura la decide la cámara (varía de ~160x120 a
 * varios megapixeles según el modelo) — es lo máximo que se puede lograr
 * sin un decodificador de RAW completo corriendo en el navegador, que no
 * existe de forma práctica hoy. El archivo original, sin tocar, se puede
 * respaldar aparte (ver `backupRaw` en PhotoUploadQueue) sin este límite.
 * `resizeSide`, si se da, le pide al navegador decodificar ya reescalado —
 * mucho más barato en CPU/memoria que decodificar completo y reescalar
 * después (crítico para miniaturas locales de archivos en alta resolución). */
async function decodeToBitmap(file: File, resizeSide?: number): Promise<ImageBitmap> {
  const opts = resizeSide ? { resizeWidth: resizeSide, resizeHeight: resizeSide, resizeQuality: 'medium' as const } : undefined
  if (!isRawFile(file)) return createImageBitmap(file, opts)

  const thumb = await exifThumbnail(file).catch(() => null)
  if (!thumb) {
    throw new Error('Este archivo RAW no trae una miniatura incrustada — la cámara no la generó, o el formato no es compatible.')
  }
  return createImageBitmap(new Blob([new Uint8Array(thumb)], { type: 'image/jpeg' }), opts)
}

async function renderThumbnailBlob(file: File, maxSide: number, quality: number): Promise<Blob | null> {
  const bitmap = await decodeToBitmap(file, maxSide)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
  })
}

/** Miniatura pequeña y rápida para la cola de subida local — nunca la
 * versión completa reescalada (esa es `createWatermarkedPreview`, mucho
 * más cara). Devuelve un object URL; quien la use debe revocarla con
 * `URL.revokeObjectURL` cuando ya no la necesite. Null si el archivo no se
 * pudo decodificar en absoluto (RAW sin miniatura incrustada) — el llamador
 * debe mostrar un ícono de reemplazo, no bloquear el resto de la cola. */
export async function createLocalThumbnail(file: File, maxSide = LOCAL_THUMBNAIL_MAX_SIDE): Promise<string | null> {
  try {
    const blob = await renderThumbnailBlob(file, maxSide, 0.7)
    return blob ? URL.createObjectURL(blob) : null
  } catch {
    return null
  }
}

/** Miniatura que se SUBE y persiste junto a la foto (ver
 * GRID_THUMBNAIL_MAX_SIDE) — a diferencia de `createLocalThumbnail`, esta
 * sí necesita el Blob en sí (para el PUT a R2), no un object URL. Null en
 * el mismo caso que arriba: no bloquea la subida, el visor cae de vuelta al
 * preview normal para esta foto puntual (ver `thumbnailUrl` en lib/r2.ts). */
export async function createGridThumbnailBlob(file: File): Promise<Blob | null> {
  try {
    return await renderThumbnailBlob(file, GRID_THUMBNAIL_MAX_SIDE, GRID_THUMBNAIL_QUALITY)
  } catch {
    return null
  }
}

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

/** Hora real de la toma, leída del EXIF (DateTimeOriginal) — es la base de
 * la clasificación automática por segmentos de tiempo (ver photoSegments.ts).
 * Null si el archivo no trae EXIF (capturas de pantalla, reenvíos de
 * WhatsApp, algunas apps de cámara Android lo eliminan) — nunca bloquea la
 * subida, esas fotos simplemente caen en el grupo "sin hora registrada". */
export async function extractCapturedAt(file: File): Promise<string | null> {
  try {
    const exif = await parseExif(file, ['DateTimeOriginal', 'CreateDate'])
    const date: Date | undefined = exif?.DateTimeOriginal ?? exif?.CreateDate
    if (!date || Number.isNaN(date.getTime())) return null
    return date.toISOString()
  } catch {
    return null
  }
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
  const bitmap = await decodeToBitmap(file)
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
  const bitmap = await decodeToBitmap(file)
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
