export interface PricingTier {
  photo_count: number
  total_price: number
}

/** Calcula cuánto cobra un fotógrafo por `count` fotos suyas en un mismo
 * pedido, según SU PROPIA tabla de precios por volumen (reemplaza el 15%
 * genérico anterior — ver el documento de precios, sección C).
 *
 * La tabla es libre (no una fórmula): el fotógrafo define "N fotos → Q
 * total" para los escalones que quiera, sin que tengan que ser
 * consecutivos. Para cualquier cantidad que no calce exacto con un
 * escalón, se interpola linealmente entre los dos escalones que la
 * rodean — con (0 fotos, Q0) como ancla implícita por debajo del primer
 * escalón definido. Más allá del último escalón, se extrapola con la
 * pendiente de su último tramo (el "ritmo marginal" del último salto que
 * el fotógrafo definió) — así nunca se queda "sin tabla" sin importar
 * cuántas fotos compren.
 *
 * Sin ningún escalón definido, no hay descuento: precio de lista × cantidad. */
export function computeVolumePrice(tiers: PricingTier[], count: number, faceValueSum: number): number {
  if (count <= 0) return 0
  if (tiers.length === 0) return faceValueSum

  const points = [{ photo_count: 0, total_price: 0 }, ...tiers].sort((a, b) => a.photo_count - b.photo_count)

  // Encuentra el segmento [a,b] que contiene `count` — o, si `count` cae
  // más allá del último punto, usa el ÚLTIMO segmento para extrapolar.
  let a = points[0]
  let b = points[points.length - 1]
  for (let i = 0; i < points.length - 1; i++) {
    if (count >= points[i].photo_count && count <= points[i + 1].photo_count) {
      a = points[i]
      b = points[i + 1]
      break
    }
    if (i === points.length - 2) {
      a = points[i]
      b = points[i + 1]
    }
  }

  if (b.photo_count === a.photo_count) return a.total_price
  const slope = (b.total_price - a.total_price) / (b.photo_count - a.photo_count)
  const total = a.total_price + (count - a.photo_count) * slope
  return Math.max(0, Math.round(total * 100) / 100)
}
