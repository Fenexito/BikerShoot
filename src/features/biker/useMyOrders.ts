import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { deriveEffectiveStatus, deriveOverallStatus, type EffectiveOrderStatus, type OrderItemStatus } from '../../lib/orderStatus'
import type { GridPhoto } from './components/PhotoGrid'

export interface MyOrderItemPhoto {
  id: string
  event_id: string
  photographer_id: string
  storage_path: string | null
  preview_path: string | null
  delivered_path: string | null
  raw_path: string | null
  price: number
  featured: boolean
  original_filename: string | null
  created_at: string
  point: { label: string; time_start: string; time_end: string } | null
}

export interface MyOrderItem {
  id: string
  photo_id: string
  photographer_id: string
  price: number
  status: OrderItemStatus
  photo: MyOrderItemPhoto | null
  event: { title: string } | null
  photographer: { display_name: string } | null
}

export interface MyOrder {
  id: string
  order_number: number | null
  payment_method: 'tarjeta' | 'transferencia'
  total: number
  created_at: string
  order_items: MyOrderItem[]
  order_payment_proofs: { photographer_id: string }[]
}

/** Un pedido puede tener fotos de varios fotógrafos (ver `useCartPricing`
 * — el checkout ya agrupa así) — cada uno se paga y se entrega por
 * separado, así que cada uno tiene su PROPIO status efectivo. */
export interface MyOrderPhotographerGroup {
  photographerId: string
  photographerName: string
  items: MyOrderItem[]
  subtotal: number
  effectiveStatus: EffectiveOrderStatus
}

/** Mismo criterio que el lado del fotógrafo (useMyOrders.ts de Studio): un
 * grupo de fotos no está "Entregado" hasta que TODAS las no canceladas lo
 * estén, y cualquier pago pendiente domina sobre lo demás. */
export function deriveGroupStatus(items: { status: OrderItemStatus }[]): OrderItemStatus {
  const active = items.filter((i) => i.status !== 'cancelado')
  if (active.length === 0) return 'cancelado'
  if (active.some((i) => i.status === 'pendiente_pago')) return 'pendiente_pago'
  if (active.every((i) => i.status === 'entregado')) return 'entregado'
  return 'en_preparacion'
}

/** Agrupa los items de un pedido por fotógrafo y calcula el status
 * efectivo de cada uno (con o sin comprobante todavía) — base para mostrar
 * "cuáles fotógrafos ya completaron y cuáles no" dentro de un mismo pedido. */
export function groupOrderByPhotographer(order: MyOrder): MyOrderPhotographerGroup[] {
  const proofPhotographerIds = new Set(order.order_payment_proofs.map((p) => p.photographer_id))
  const byPhotographer = new Map<string, MyOrderItem[]>()
  for (const item of order.order_items) {
    const list = byPhotographer.get(item.photographer_id) ?? []
    list.push(item)
    byPhotographer.set(item.photographer_id, list)
  }
  return Array.from(byPhotographer.entries()).map(([photographerId, items]) => ({
    photographerId,
    photographerName: items[0].photographer?.display_name ?? 'Fotógrafo',
    items,
    subtotal: items.reduce((s, i) => s + i.price, 0),
    effectiveStatus: deriveEffectiveStatus({
      status: deriveGroupStatus(items),
      paymentMethod: order.payment_method,
      hasProof: proofPhotographerIds.has(photographerId),
    }),
  }))
}

/** Status efectivo del pedido COMPLETO — el menos avanzado de todos sus
 * fotógrafos (ver `deriveOverallStatus`), para que la lista de "Mis
 * compras" muestre un solo status por pedido sin ocultar que a alguno
 * todavía le falta algo. */
export function deriveOrderEffectiveStatus(order: MyOrder): EffectiveOrderStatus {
  return deriveOverallStatus(groupOrderByPhotographer(order).map((g) => g.effectiveStatus))
}

/** Adapta un item de "Mis compras" a la forma que espera el visor
 * compartido (`PhotoLightbox`, el mismo de Buscar) — así el mismo
 * componente sirve para ver fotos a la venta y fotos ya compradas, sin
 * duplicar toda su lógica de zoom/gestos/flechas. Un item sin `photo`
 * (borrado, corrupto) no se puede ver — el caller debe filtrarlo antes. */
export function toGridPhoto(item: MyOrderItem): GridPhoto | null {
  if (!item.photo) return null
  return {
    id: item.photo.id,
    event_id: item.photo.event_id,
    photographer_id: item.photographer_id,
    point_id: null,
    storage_path: item.photo.storage_path,
    preview_path: item.photo.preview_path,
    raw_path: item.photo.raw_path,
    delivered_path: item.photo.delivered_path,
    price: item.photo.price,
    moto_brand: null,
    featured: item.photo.featured,
    original_filename: item.photo.original_filename,
    created_at: item.photo.created_at,
    eventTitle: item.event?.title ?? '',
    photographerName: item.photographer?.display_name ?? 'Fotógrafo',
    pointLabel: item.photo.point?.label,
    pointTimeStart: item.photo.point?.time_start,
    pointTimeEnd: item.photo.point?.time_end,
  }
}

export function useMyOrders(bikerId: string | undefined) {
  return useQuery({
    queryKey: ['my-orders', bikerId],
    queryFn: async (): Promise<MyOrder[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          '*, order_items(*, photo:photos(id, event_id, photographer_id, storage_path, preview_path, delivered_path, raw_path, price, featured, original_filename, created_at, point:event_points(label, time_start, time_end)), event:events(title), photographer:profiles(display_name)), order_payment_proofs(photographer_id)',
        )
        .eq('biker_id', bikerId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as MyOrder[]) ?? []
    },
    enabled: !!bikerId,
  })
}
