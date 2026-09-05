import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { OrderItemStatus } from '../../lib/orderStatus'

export interface MyOrderItem {
  id: string
  photo_id: string
  photographer_id: string
  price: number
  status: OrderItemStatus
  photo: { storage_path: string | null; preview_path: string | null; delivered_path: string | null } | null
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

export function useMyOrders(bikerId: string | undefined) {
  return useQuery({
    queryKey: ['my-orders', bikerId],
    queryFn: async (): Promise<MyOrder[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, photo:photos(storage_path, preview_path, delivered_path), event:events(title), photographer:profiles(display_name))')
        .eq('biker_id', bikerId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as MyOrder[]) ?? []
    },
    enabled: !!bikerId,
  })
}
