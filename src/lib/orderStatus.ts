export type OrderItemStatus = 'pendiente_pago' | 'en_preparacion' | 'entregado' | 'cancelado'

export const ORDER_STATUS_STYLE: Record<OrderItemStatus, { label: string; dot: string; text: string }> = {
  pendiente_pago: { label: 'Pendiente de pago', dot: 'bg-blue-500', text: 'text-blue-500' },
  en_preparacion: { label: 'En preparación', dot: 'bg-amber-500', text: 'text-amber-500' },
  entregado: { label: 'Entregado', dot: 'bg-emerald-500', text: 'text-emerald-500' },
  cancelado: { label: 'Cancelado', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
}

/** Nunca revienta con un status desconocido (ej. datos viejos antes de correr
 * la migración 0019, que fusionó 'activo'/'finalizado' en 'en_preparacion'). */
export function getOrderStatusStyle(status: string) {
  return ORDER_STATUS_STYLE[status as OrderItemStatus] ?? ORDER_STATUS_STYLE.en_preparacion
}

/** Código corto de pedido — #000938 solo, o #000938-Mendz si se da un
 * nombre de estudio (el sufijo se calcula siempre al vuelo desde el nombre
 * actual, nunca se guarda, así un fotógrafo puede renombrar su estudio sin
 * dejar códigos viejos rotos). */
export function formatOrderCode(orderNumber: number | null | undefined, studioName?: string | null) {
  if (orderNumber == null) return '—'
  const base = `#${String(orderNumber).padStart(6, '0')}`
  if (!studioName) return base
  const suffix = studioName
    .normalize('NFD')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6)
  return suffix ? `${base}-${suffix}` : base
}

/**
 * Status "efectivo" — más rico que `OrderItemStatus` (la columna real en
 * `order_items`, que no cambia) sin tocar el esquema: se deriva en el
 * cliente combinando `status` + `payment_method` + si ya existe un
 * comprobante subido para ese (pedido, fotógrafo). Antes "pendiente_pago"
 * cubría dos situaciones muy distintas para el biker — "todavía no subí mi
 * comprobante" y "ya lo subí, el fotógrafo tiene que confirmar" — sin
 * ninguna forma de distinguirlas en pantalla.
 *
 * `entrega_parcial` solo aplica al agrupar VARIOS fotógrafos de un mismo
 * pedido (ver `deriveOverallStatus`) — a nivel de un solo grupo
 * fotógrafo→pedido no existe entrega parcial, es "entregado" o no.
 */
export type EffectiveOrderStatus =
  | 'pendiente_comprobante'
  | 'pendiente_confirmacion'
  | 'en_preparacion'
  | 'entrega_parcial'
  | 'entregado'
  | 'cancelado'

export const EFFECTIVE_STATUS_STYLE: Record<EffectiveOrderStatus, { label: string; dot: string; text: string }> = {
  pendiente_comprobante: { label: 'Falta subir comprobante', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
  pendiente_confirmacion: { label: 'Pago por confirmar', dot: 'bg-blue-500', text: 'text-blue-500' },
  en_preparacion: { label: 'En preparación', dot: 'bg-amber-500', text: 'text-amber-500' },
  entrega_parcial: { label: 'Entrega parcial', dot: 'bg-amber-500', text: 'text-amber-500' },
  entregado: { label: 'Entregado', dot: 'bg-emerald-500', text: 'text-emerald-500' },
  // A diferencia de `ORDER_STATUS_STYLE.cancelado` (gris, "esto ya no
  // importa") acá se pidió explícitamente rojo — un pedido cancelado sigue
  // siendo información relevante que el biker/fotógrafo debe notar, no
  // algo para ignorar.
  cancelado: { label: 'Cancelado', dot: 'bg-red-500', text: 'text-red-500' },
}

export function getEffectiveStatusStyle(status: string) {
  return EFFECTIVE_STATUS_STYLE[status as EffectiveOrderStatus] ?? EFFECTIVE_STATUS_STYLE.en_preparacion
}

/** Deriva el status efectivo de UN grupo fotógrafo→pedido. `hasProof` es
 * irrelevante para tarjeta (ese método no pasa por comprobante manual) —
 * ahí "pendiente_pago" en la base ya significa "pago con tarjeta sin
 * procesar todavía", que hoy en la práctica no ocurre (el método real
 * activo es transferencia), pero se maneja igual por si acaso. */
export function deriveEffectiveStatus({
  status,
  paymentMethod,
  hasProof,
}: {
  status: OrderItemStatus
  paymentMethod: 'tarjeta' | 'transferencia'
  hasProof: boolean
}): EffectiveOrderStatus {
  if (status === 'cancelado') return 'cancelado'
  if (status === 'entregado') return 'entregado'
  if (status === 'en_preparacion') return 'en_preparacion'
  // status === 'pendiente_pago'
  if (paymentMethod === 'transferencia' && !hasProof) return 'pendiente_comprobante'
  return 'pendiente_confirmacion'
}

// Del menos al más avanzado — para un pedido con varios fotógrafos, el
// status "general" que ve el biker es el MENOS avanzado de todos: mientras
// uno solo no haya entregado, el pedido como un todo no está completo.
const STATUS_RANK: Record<EffectiveOrderStatus, number> = {
  cancelado: 0,
  pendiente_comprobante: 1,
  pendiente_confirmacion: 2,
  en_preparacion: 3,
  entrega_parcial: 4,
  entregado: 5,
}

/** Status "general" de un pedido con uno o más fotógrafos — ve cuáles ya
 * completaron y cuáles no; si hay mezcla de "entregado" con cualquier otra
 * cosa que no sea cancelado, es "entrega_parcial" (ver el requisito: el
 * biker debe poder distinguir cuáles fotógrafos ya terminaron). Un
 * "cancelado" mezclado con otros no-cancelados no debería opacar al resto
 * — por eso se ignoran los cancelados salvo que sea el único status. */
export function deriveOverallStatus(groupStatuses: EffectiveOrderStatus[]): EffectiveOrderStatus {
  const active = groupStatuses.filter((s) => s !== 'cancelado')
  if (active.length === 0) return groupStatuses[0] ?? 'cancelado'
  if (active.length > 1 && active.some((s) => s === 'entregado') && active.some((s) => s !== 'entregado')) {
    return 'entrega_parcial'
  }
  return active.reduce((least, s) => (STATUS_RANK[s] < STATUS_RANK[least] ? s : least), active[0])
}
