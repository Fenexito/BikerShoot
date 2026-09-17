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

/** Dentro de este radio Y con el mismo nombre, dos puntos se consideran el
 * mismo lugar físico — sin importar quién los creó. Un nombre distinto a la
 * misma distancia (ej. "VP Racing (Entrada)" vs. "VP Racing (Salida)", o
 * "Zumpango Km 14 (Ida)" vs. "(Regreso)") es un punto real y reutilizable a
 * propósito: mismo lugar, pero fotógrafos distintos según hacia dónde mira
 * la moto — no debe bloquearse como duplicado. */
export const DUPLICATE_POINT_THRESHOLD_M = 30

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase()
}

/** true si `a` y `b` son, a efectos del catálogo de puntos, el mismo punto:
 * mismo nombre (sin importar mayúsculas/espacios) Y a menos de
 * DUPLICATE_POINT_THRESHOLD_M metros. */
export function isSamePoint(a: { label: string; lat: number; lng: number }, b: { label: string; lat: number; lng: number }): boolean {
  if (normalizeLabel(a.label) !== normalizeLabel(b.label)) return false
  return haversineMeters(a.lat, a.lng, b.lat, b.lng) <= DUPLICATE_POINT_THRESHOLD_M
}
