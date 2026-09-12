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
 * dentro de un pedido — interpola entre los escalones definidos arriba y
 * se queda plana en el tope (Q10) más allá del último. */
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
  if (b.photo_count === a.photo_count) return a.total_price
  const slope = (b.total_price - a.total_price) / (b.photo_count - a.photo_count)
  const total = a.total_price + (count - a.photo_count) * slope
  return Math.min(SERVICE_FEE_CAP, Math.max(0, Math.round(total * 100) / 100))
}

/** Reparte una tarifa de grupo (ver `computeServiceFee`) entre los
 * `count` order_items individuales de ese fotógrafo en el pedido — cada
 * fila necesita su propio valor para el saldo pendiente por liquidar, y
 * la suma debe cuadrar exacto con el total del grupo (el resto de
 * redondeo se lo lleva el último ítem). */
export function distributeServiceFee(groupTotal: number, count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor((groupTotal / count) * 100) / 100
  const fees = Array(count).fill(base)
  const remainder = Math.round((groupTotal - base * count) * 100) / 100
  fees[count - 1] = Math.round((fees[count - 1] + remainder) * 100) / 100
  return fees
}
