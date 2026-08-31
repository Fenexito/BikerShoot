/** Indicador de frescura para fotos recién subidas — null pasada la primera semana
 * (ya no aporta, en ese punto la fecha del evento es la referencia relevante). */
export function timeAgo(iso: string): string | null {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Recién subida'
  if (minutes < 60) return `Subida hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Subida hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `Subida hace ${days}d`
  return null
}
