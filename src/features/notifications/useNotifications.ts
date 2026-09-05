import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'

export type NotificationType = 'pedido_nuevo' | 'pedido_entregado' | 'pedido_cancelado' | 'fotografo_aprobado'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return data ?? []
    },
    enabled: !!userId,
    refetchInterval: 60_000,
  })
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notificationId)
  queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
}

export async function markAllNotificationsRead(userId: string, ids: string[]) {
  if (ids.length === 0) return
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids)
  queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
}
