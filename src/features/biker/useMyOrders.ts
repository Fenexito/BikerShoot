import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface MyOrderItem {
  id: string
  photo_id: string
  price: number
  status: string
  photo: { storage_path: string | null; preview_path: string | null; delivered_path: string | null } | null
  event: { title: string } | null
  photographer: { display_name: string } | null
}

export interface MyOrder {
  id: string
  payment_method: 'tarjeta' | 'transferencia'
  total: number
  created_at: string
  order_items: MyOrderItem[]
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
