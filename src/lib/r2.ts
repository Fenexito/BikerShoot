const R2_PUBLIC_URL = (import.meta.env.VITE_R2_PUBLIC_URL as string | undefined)?.replace(/\/$/, '')

export function r2Url(storagePath: string): string {
  if (!R2_PUBLIC_URL) return ''
  return `${R2_PUBLIC_URL}/${storagePath}`
}

export function hasR2PublicUrl(): boolean {
  return !!R2_PUBLIC_URL
}
