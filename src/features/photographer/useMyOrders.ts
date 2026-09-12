import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { deriveEffectiveStatus, type EffectiveOrderStatus, type OrderItemStatus } from '../../lib/orderStatus'
import type { GridPhoto } from '../biker/components/PhotoGrid'

export type { OrderItemStatus }

export interface RawOrderItemPhoto {
  id: string
  storage_path: string | null
  preview_path: string | null
  delivered_path: string | null
  raw_path: string | null
  original_filename: string | null
  featured: boolean
  created_at: string
  point: { label: string; time_start: string; time_end: string } | null
}

export interface RawOrderItem {
  id: string
  order_id: string
  photo_id: string
  event_id: string
  photographer_id: string
  price: number
  service_fee: number
  is_courtesy: boolean
  courtesy_type: 'waiver' | 'extra' | null
  status: OrderItemStatus
  created_at: string
  photographer_note: string | null
  cancellation_reason: string | null
  paid_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  photo: RawOrderItemPhoto | null
  event: { title: string } | null
  order: { order_number: number; payment_method: 'tarjeta' | 'transferencia'; created_at: string; biker: { id: string; display_name: string; phone: string | null } | null } | null
}

/** Adapta un item de pedido (lado fotógrafo) a la forma que espera el
 * visor compartido (mismo `PhotoLightbox` que usa Buscar y Mis compras) —
 * el biker ya no es quien decide qué visor usar el fotógrafo, es el MISMO
 * componente en los tres lugares. */
export function toGridPhoto(item: RawOrderItem, eventTitle: string, photographerName: string): GridPhoto | null {
  if (!item.photo) return null
  return {
    id: item.photo.id,
    event_id: item.event_id,
    photographer_id: item.photographer_id,
    point_id: null,
    storage_path: item.photo.storage_path,
    preview_path: item.photo.preview_path,
    raw_path: item.photo.raw_path,
    delivered_path: item.photo.delivered_path,
    price: item.price,
    moto_brand: null,
    featured: item.photo.featured,
    original_filename: item.photo.original_filename,
    created_at: item.photo.created_at,
    eventTitle,
    photographerName,
    pointLabel: item.photo.point?.label,
    pointTimeStart: item.photo.point?.time_start,
    pointTimeEnd: item.photo.point?.time_end,
  }
}

export interface PhotographerOrderGroup {
  orderId: string
  orderNumber: number | null
  bikerId: string | null
  bikerName: string
  bikerPhone: string | null
  eventTitle: string
  paymentMethod: 'tarjeta' | 'transferencia'
  createdAt: string
  status: OrderItemStatus
  /** Status enriquecido (ver `deriveEffectiveStatus`) — distingue "el biker
   * todavía no sube su comprobante" de "ya lo subió, falta que yo
   * confirme", ambos indistinguibles en `status` (los dos son
   * 'pendiente_pago'). */
  effectiveStatus: EffectiveOrderStatus
  hasPaymentProof: boolean
  total: number
  serviceFeeTotal: number
  note: string | null
  paidAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  cancellationReason: string | null
  items: RawOrderItem[]
}

function useRawOrderItems(photographerId: string | undefined) {
  return useQuery({
    queryKey: ['photographer-order-items', photographerId],
    queryFn: async (): Promise<RawOrderItem[]> => {
      const { data, error } = await supabase
        .from('order_items')
        .select('*, photo:photos(id, storage_path, preview_path, delivered_path, raw_path, original_filename, featured, created_at, point:event_points(label, time_start, time_end)), event:events(title), order:orders(order_number, payment_method, created_at, biker:profiles(id, display_name, phone))')
        .eq('photographer_id', photographerId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as RawOrderItem[]) ?? []
    },
    enabled: !!photographerId,
  })
}

/** El estado del PEDIDO no es el de una fila cualquiera — un pedido de 3
 * fotos no está "Entregado" hasta que las 3 lo estén. Prioridad: si falta
 * algún pago, el pedido entero sigue pendiente de pago; si no, solo es
 * "Entregado" cuando TODAS las fotos (no canceladas) lo están; cualquier
 * otro caso es "En preparación". */
function deriveOrderStatus(items: { status: OrderItemStatus }[]): OrderItemStatus {
  const active = items.filter((i) => i.status !== 'cancelado')
  if (active.length === 0) return 'cancelado'
  if (active.some((i) => i.status === 'pendiente_pago')) return 'pendiente_pago'
  if (active.every((i) => i.status === 'entregado')) return 'entregado'
  return 'en_preparacion'
}

function usePaymentProofOrderIds(photographerId: string | undefined) {
  return useQuery({
    queryKey: ['photographer-payment-proof-order-ids', photographerId],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from('order_payment_proofs').select('order_id').eq('photographer_id', photographerId)
      if (error) throw error
      return new Set((data ?? []).map((r) => r.order_id))
    },
    enabled: !!photographerId,
  })
}

export function usePhotographerOrders(photographerId: string | undefined) {
  const query = useRawOrderItems(photographerId)
  const { data: proofOrderIds = new Set<string>() } = usePaymentProofOrderIds(photographerId)

  const groups = useMemo((): PhotographerOrderGroup[] => {
    const byOrder = new Map<string, RawOrderItem[]>()
    for (const item of query.data ?? []) {
      const list = byOrder.get(item.order_id) ?? []
      list.push(item)
      byOrder.set(item.order_id, list)
    }
    return Array.from(byOrder.entries()).map(([orderId, items]) => {
      const status = deriveOrderStatus(items)
      const paymentMethod = items[0].order?.payment_method ?? 'tarjeta'
      const hasPaymentProof = proofOrderIds.has(orderId)
      return {
      orderId,
      orderNumber: items[0].order?.order_number ?? null,
      bikerId: items[0].order?.biker?.id ?? null,
      bikerName: items[0].order?.biker?.display_name ?? 'Biker',
      bikerPhone: items[0].order?.biker?.phone ?? null,
      eventTitle: items[0].event?.title ?? '',
      paymentMethod,
      createdAt: items[0].order?.created_at ?? items[0].created_at,
      status,
      effectiveStatus: deriveEffectiveStatus({ status, paymentMethod, hasProof: hasPaymentProof }),
      hasPaymentProof,
      // Lo que el biker de verdad transfiere a este fotógrafo — incluye la
      // tarifa de servicio de cada foto (Q2, salvo cortesías), que el
      // fotógrafo recibe junto con el resto pero le debe de vuelta a
      // MotoShots en su próxima factura de plan (ver `service_fee` por
      // item más abajo, y `usePendingServiceFees` para el saldo total).
      total: items.reduce((sum, i) => sum + i.price + i.service_fee, 0),
      serviceFeeTotal: items.reduce((sum, i) => sum + i.service_fee, 0),
      note: items.find((i) => i.photographer_note)?.photographer_note ?? null,
      paidAt: items.find((i) => i.paid_at)?.paid_at ?? null,
      deliveredAt: items.every((i) => i.delivered_at || i.status === 'cancelado')
        ? items.map((i) => i.delivered_at).filter(Boolean).sort().slice(-1)[0] ?? null
        : null,
      cancelledAt: items.find((i) => i.cancelled_at)?.cancelled_at ?? null,
      cancellationReason: items.find((i) => i.cancellation_reason)?.cancellation_reason ?? null,
      items,
    }
    })
  }, [query.data, proofOrderIds])

  return { ...query, data: groups }
}

export function useOrderGroup(photographerId: string | undefined, orderId: string | undefined) {
  const { data: groups, ...rest } = usePhotographerOrders(photographerId)
  const group = groups.find((g) => g.orderId === orderId)
  return { ...rest, data: group }
}
