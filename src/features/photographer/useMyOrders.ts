import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export type OrderItemStatus = 'pendiente_pago' | 'activo' | 'finalizado' | 'entregado' | 'cancelado'

interface RawOrderItem {
  id: string
  order_id: string
  photo_id: string
  price: number
  status: OrderItemStatus
  created_at: string
  photo: { storage_path: string; preview_path: string | null } | null
  event: { title: string } | null
  order: { payment_method: 'tarjeta' | 'transferencia'; created_at: string; biker: { display_name: string } | null } | null
}

export interface PhotographerOrderGroup {
  orderId: string
  bikerName: string
  eventTitle: string
  paymentMethod: 'tarjeta' | 'transferencia'
  createdAt: string
  status: OrderItemStatus
  total: number
  items: RawOrderItem[]
}

function useRawOrderItems(photographerId: string | undefined) {
  return useQuery({
    queryKey: ['photographer-order-items', photographerId],
    queryFn: async (): Promise<RawOrderItem[]> => {
      const { data, error } = await supabase
        .from('order_items')
        .select('*, photo:photos(storage_path, preview_path), event:events(title), order:orders(payment_method, created_at, biker:profiles(display_name))')
        .eq('photographer_id', photographerId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as RawOrderItem[]) ?? []
    },
    enabled: !!photographerId,
  })
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
      bikerName: items[0].order?.biker?.display_name ?? 'Biker',
      eventTitle: items[0].event?.title ?? '',
      paymentMethod: items[0].order?.payment_method ?? 'tarjeta',
      createdAt: items[0].order?.created_at ?? items[0].created_at,
      status: items[0].status,
      total: items.reduce((sum, i) => sum + i.price, 0),
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
