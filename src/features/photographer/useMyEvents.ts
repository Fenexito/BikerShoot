import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface DbEventPoint {
  id: string
  event_id: string
  label: string
  lat: number
  lng: number
  time_start: string
  time_end: string
}

export interface DbEvent {
  id: string
  photographer_id: string
  title: string
  category: 'Rodada' | 'Pista' | 'Exhibición' | 'Concentración'
  city: string
  venue: string | null
  event_date: string
  price_per_photo: number
  description: string | null
  status: 'activo' | 'cerrado'
  cover_path: string | null
  created_at: string
  event_points: DbEventPoint[]
}

export function useMyEvents(photographerId: string | undefined) {
  return useQuery({
    queryKey: ['my-events', photographerId],
    queryFn: async (): Promise<DbEvent[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*, event_points(*)')
        .eq('photographer_id', photographerId)
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
