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
 * Sin ningún escalón definido, no hay descuento: precio de lista × cantidad.
 * Siempre redondea HACIA ARRIBA al quetzal — cobramos únicamente montos
 * enteros, nunca centavos que nadie termina pagando de verdad. */
export function computeVolumePrice(tiers: PricingTier[], count: number, faceValueSum: number): number {
  if (count <= 0) return 0
  if (tiers.length === 0) return Math.ceil(faceValueSum)

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

  if (b.photo_count === a.photo_count) return Math.ceil(a.total_price)
  const slope = (b.total_price - a.total_price) / (b.photo_count - a.photo_count)
  const total = a.total_price + (count - a.photo_count) * slope
  return Math.max(0, Math.ceil(total))
}

/** Escalones FIJOS de nuestra propia tarifa de servicio — a diferencia de
 * `computeVolumePrice` (la tabla del fotógrafo, que el fotógrafo elige y
 * que se extrapola SIN límite), esta es la misma para todos y tiene un
 * TOPE duro: más allá del último escalón, la tarifa deja de crecer. Nace
 * de un ajuste explícito pedido por el usuario — Q2/foto sin tope se
 * sentía "un golpe" en pedidos de varias fotos (Q10 en un pedido de 5),
 * aunque proporcionalmente fuera la misma carga que una sola foto. Un
 * monto fijo por pedido tampoco servía (penaliza al que compra 1 sola
 * foto, y no queda claro cómo repartirlo entre varios fotógrafos en un
 * mismo carrito) — así que, igual que la tabla del fotógrafo, esto se
 * calcula POR FOTÓGRAFO dentro del pedido, nunca sobre el pedido entero. */
const SERVICE_FEE_TIERS: PricingTier[] = [
  { photo_count: 1, total_price: 2 },
  { photo_count: 2, total_price: 3.5 },
  { photo_count: 3, total_price: 5 },
  { photo_count: 5, total_price: 7 },
  { photo_count: 8, total_price: 9 },
  { photo_count: 10, total_price: 10 },
]
const SERVICE_FEE_CAP = 10

/** Tarifa de servicio total para `count` fotos de UN MISMO fotógrafo
 * dentro de un pedido — interpola entre los escalones definidos arriba,
 * se queda plana en el tope (Q10) más allá del último, y redondea hacia
 * arriba al quetzal (mismo criterio que `computeVolumePrice`). */
export function computeServiceFee(count: number): number {
  if (count <= 0) return 0
  const points = [{ photo_count: 0, total_price: 0 }, ...SERVICE_FEE_TIERS]
  let a = points[0]
  let b = points[points.length - 1]
  for (let i = 0; i < points.length - 1; i++) {
    if (count >= points[i].photo_count && count <= points[i + 1].photo_count) {
      a = points[i]
      b = points[i + 1]
      break
    }
  }
  if (b.photo_count === a.photo_count) return Math.min(SERVICE_FEE_CAP, Math.ceil(a.total_price))
  const slope = (b.total_price - a.total_price) / (b.photo_count - a.photo_count)
  const total = a.total_price + (count - a.photo_count) * slope
  return Math.min(SERVICE_FEE_CAP, Math.max(0, Math.ceil(total)))
}

/** Reparte un monto YA ENTERO entre varios ítems, en proporción a
 * `weights` (ej. el precio de lista de cada foto, o 1 por foto si se
 * quiere parejo) — método de "mayor resto": cada quien se lleva el
 * entero hacia abajo de su parte proporcional, y el resto (siempre un
 * número entero de quetzales, nunca centavos) se reparte de a uno,
 * empezando por quien perdió más en el redondeo hacia abajo. La suma de
 * lo repartido siempre cuadra exacto con `total`. */
export function distributeAmount(total: number, weights: number[]): number[] {
  const n = weights.length
  if (n === 0) return []
  const sumWeights = weights.reduce((s, w) => s + w, 0)
  if (sumWeights <= 0) {
    // Sin pesos reales (ej. precios en 0, como una cortesía) — reparte
    // parejo entre todos.
    return distributeAmount(total, weights.map(() => 1))
  }
  const raw = weights.map((w) => (total * w) / sumWeights)
  const floors = raw.map((r) => Math.floor(r))
  const distributed = floors.reduce((s, f) => s + f, 0)
  const remainder = Math.round(total - distributed)
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((x, y) => y.frac - x.frac)
  const result = [...floors]
  for (let k = 0; k < remainder; k++) result[order[k % n].i] += 1
  return result
}

/** Reparte la tarifa de servicio de un grupo (ya entera, ver
 * `computeServiceFee`) parejo entre sus `count` order_items — cada fila
 * necesita su propio valor para el saldo pendiente por liquidar. */
export function distributeServiceFee(groupTotal: number, count: number): number[] {
  return distributeAmount(groupTotal, Array(count).fill(1))
}
