/** Distancia real entre dos coordenadas (fórmula haversine), en metros —
 * base del chequeo de "punto duplicado" (dos puntos casi en el mismo lugar,
 * aunque tengan nombres distintos, son el mismo lugar físico). */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Dentro de este radio, dos puntos se consideran el mismo lugar físico —
 * sin importar quién los creó o con qué nombre. */
export const DUPLICATE_POINT_THRESHOLD_M = 30
