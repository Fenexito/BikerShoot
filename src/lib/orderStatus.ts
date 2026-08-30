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
