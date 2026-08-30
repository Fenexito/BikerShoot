const R2_PUBLIC_URL = (import.meta.env.VITE_R2_PUBLIC_URL as string | undefined)?.replace(/\/$/, '')

export function r2Url(storagePath: string): string {
  if (!R2_PUBLIC_URL) return ''
  return `${R2_PUBLIC_URL}/${storagePath}`
}

export function hasR2PublicUrl(): boolean {
  return !!R2_PUBLIC_URL
}

/**
 * URL para NAVEGAR/mostrar una foto (grid, lightbox, carrito) — siempre la
 * versión con marca de agua si existe. Fotos subidas antes de separar
 * original/preview no tienen preview_path: para esas caemos de vuelta a
 * storage_path (que en ese caso todavía vive en el bucket público viejo).
 * Nunca usar esto para dar acceso de descarga al original comprado — para
 * eso está la Edge Function r2-download-url.
 */
export function previewUrl(photo: { storage_path: string | null; preview_path: string | null }): string {
  return r2Url(photo.preview_path ?? photo.storage_path ?? '')
}
