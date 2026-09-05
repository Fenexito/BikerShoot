import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { OrderItemStatus } from '../../lib/orderStatus'

export type { OrderItemStatus }

interface RawOrderItem {
  id: string
  order_id: string
  photo_id: string
  price: number
  status: OrderItemStatus
  created_at: string
  photographer_note: string | null
  cancellation_reason: string | null
  paid_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  photo: { id: string; storage_path: string | null; preview_path: string | null; delivered_path: string | null; raw_path: string | null; original_filename: string | null; featured: boolean } | null
  event: { title: string } | null
  order: { payment_method: 'tarjeta' | 'transferencia'; created_at: string; biker: { id: string; display_name: string; phone: string | null } | null } | null
}

export interface PhotographerOrderGroup {
  orderId: string
  bikerId: string | null
  bikerName: string
  bikerPhone: string | null
  eventTitle: string
  paymentMethod: 'tarjeta' | 'transferencia'
  createdAt: string
  status: OrderItemStatus
  total: number
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
        .select('*, photo:photos(id, storage_path, preview_path, delivered_path, raw_path, original_filename, featured), event:events(title), order:orders(payment_method, created_at, biker:profiles(id, display_name, phone))')
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

export function usePhotographerOrders(photographerId: string | undefined) {
  const query = useRawOrderItems(photographerId)

  const groups = useMemo((): PhotographerOrderGroup[] => {
    const byOrder = new Map<string, RawOrderItem[]>()
    for (const item of query.data ?? []) {
      const list = byOrder.get(item.order_id) ?? []
      list.push(item)
      byOrder.set(item.order_id, list)
    }
    return Array.from(byOrder.entries()).map(([orderId, items]) => ({
      orderId,
      bikerId: items[0].order?.biker?.id ?? null,
      bikerName: items[0].order?.biker?.display_name ?? 'Biker',
      bikerPhone: items[0].order?.biker?.phone ?? null,
      eventTitle: items[0].event?.title ?? '',
      paymentMethod: items[0].order?.payment_method ?? 'tarjeta',
      createdAt: items[0].order?.created_at ?? items[0].created_at,
      status: deriveOrderStatus(items),
      total: items.reduce((sum, i) => sum + i.price, 0),
      note: items.find((i) => i.photographer_note)?.photographer_note ?? null,
      paidAt: items.find((i) => i.paid_at)?.paid_at ?? null,
      deliveredAt: items.every((i) => i.delivered_at || i.status === 'cancelado')
        ? items.map((i) => i.delivered_at).filter(Boolean).sort().slice(-1)[0] ?? null
        : null,
      cancelledAt: items.find((i) => i.cancelled_at)?.cancelled_at ?? null,
      cancellationReason: items.find((i) => i.cancellation_reason)?.cancellation_reason ?? null,
      items,
    }))
  }, [query.data])

  return { ...query, data: groups }
}

export function useOrderGroup(photographerId: string | undefined, orderId: string | undefined) {
  const { data: groups, ...rest } = usePhotographerOrders(photographerId)
  const group = groups.find((g) => g.orderId === orderId)
  return { ...rest, data: group }
}
