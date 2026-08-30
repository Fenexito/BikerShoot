import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { DbEvent } from '../../types/db'

export type { DbEvent, DbEventPoint } from '../../types/db'

export interface MyEvent extends DbEvent {
  photos: { count: number }[]
}

export function useMyEvents(photographerId: string | undefined) {
  return useQuery({
    queryKey: ['my-events', photographerId],
    queryFn: async (): Promise<MyEvent[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*, event_points(*), photos(count)')
        .eq('photographer_id', photographerId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as MyEvent[]) ?? []
    },
    enabled: !!photographerId,
  })
}

export interface EventPhoto {
  id: string
  point_id: string | null
  preview_path: string | null
  storage_path: string | null
  raw_path: string | null
  delivered_path: string | null
  price: number
  size_bytes: number
  featured: boolean
  original_filename: string | null
  created_at: string
}

/** Todas las fotos de un evento propio, con detalle completo (para el visor del evento). */
export function useEventPhotosDetailed(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-photos-detailed', eventId],
    queryFn: async (): Promise<EventPhoto[]> => {
      const { data, error } = await supabase
        .from('photos')
        .select('id, point_id, preview_path, storage_path, raw_path, delivered_path, price, size_bytes, featured, original_filename, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!eventId,
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
