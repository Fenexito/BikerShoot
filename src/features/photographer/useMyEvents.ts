import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { DbEvent } from '../../types/db'

export type { DbEvent, DbEventPoint } from '../../types/db'

export function useMyEvents(photographerId: string | undefined) {
  return useQuery({
    queryKey: ['my-events', photographerId],
    queryFn: async (): Promise<DbEvent[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*, event_points(*)')
        .eq('photographer_id', photographerId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as DbEvent[]) ?? []
    },
    enabled: !!photographerId,
  })
}

export function useEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event', eventId],
    queryFn: async (): Promise<DbEvent | null> => {
      const { data, error } = await supabase
        .from('events')
        .select('*, event_points(*)')
        .eq('id', eventId)
        .single()
      if (error) throw error
      return data as unknown as DbEvent
    },
    enabled: !!eventId && eventId !== 'new',
  })
}
