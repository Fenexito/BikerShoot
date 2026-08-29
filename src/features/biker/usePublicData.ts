import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { DbEvent, DbEventPoint, DbPhoto, DbPhotographer } from '../../types/db'

export interface PublicEvent extends DbEvent {
  photographer: { display_name: string } | null
}

export interface PublicPhoto extends DbPhoto {
  event: { title: string; city: string; category: string } | null
  photographer: { display_name: string } | null
}

export interface MapPoint extends DbEventPoint {
  event: {
    id: string
    title: string
    city: string
    photographer_id: string
    photographer: { display_name: string } | null
  } | null
}

export interface SearchFilters {
  query?: string
  city?: string
  category?: string
  motoBrand?: string
  photographerId?: string
  eventId?: string
  pointId?: string
  sort?: 'relevancia' | 'precio-asc' | 'precio-desc'
}

/** Todos los eventos visibles públicamente (con sus puntos y el nombre del fotógrafo). */
export function usePublicEvents() {
  return useQuery({
    queryKey: ['public-events'],
    queryFn: async (): Promise<PublicEvent[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*, event_points(*), photographer:profiles(display_name)')
        .order('event_date', { ascending: false })
      if (error) throw error
      return (data as unknown as PublicEvent[]) ?? []
    },
  })
}

export function usePublicEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ['public-event', eventId],
    queryFn: async (): Promise<PublicEvent | null> => {
      const { data, error } = await supabase
        .from('events')
        .select('*, event_points(*), photographer:profiles(display_name)')
        .eq('id', eventId)
        .single()
      if (error) throw error
      return data as unknown as PublicEvent
    },
    enabled: !!eventId,
  })
}

export function useEventPhotos(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-photos', eventId],
    queryFn: async (): Promise<DbPhoto[]> => {
      const { data, error } = await supabase.from('photos').select('*').eq('event_id', eventId)
      if (error) throw error
      return (data as DbPhoto[]) ?? []
    },
    enabled: !!eventId,
  })
}

export function useApprovedPhotographers() {
  return useQuery({
    queryKey: ['approved-photographers'],
    queryFn: async (): Promise<DbPhotographer[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, phone, photographer_details(bio, city, whatsapp)')
        .eq('role', 'photographer')
      if (error) throw error
      return (data ?? []).map((row: any) => ({
        id: row.id,
        display_name: row.display_name,
        avatar_url: row.avatar_url,
        phone: row.phone,
        bio: row.photographer_details?.[0]?.bio ?? row.photographer_details?.bio ?? null,
        city: row.photographer_details?.[0]?.city ?? row.photographer_details?.city ?? null,
        whatsapp: row.photographer_details?.[0]?.whatsapp ?? row.photographer_details?.whatsapp ?? null,
      }))
    },
  })
}

export function usePublicPhotographer(photographerId: string | undefined) {
  return useQuery({
    queryKey: ['public-photographer', photographerId],
    queryFn: async (): Promise<DbPhotographer | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, phone, photographer_details(bio, city, whatsapp)')
        .eq('id', photographerId)
        .single()
      if (error) throw error
      const pd: any = Array.isArray(data.photographer_details) ? data.photographer_details[0] : data.photographer_details
      return {
        id: data.id,
        display_name: data.display_name,
        avatar_url: data.avatar_url,
        phone: data.phone,
        bio: pd?.bio ?? null,
        city: pd?.city ?? null,
        whatsapp: pd?.whatsapp ?? null,
      }
    },
    enabled: !!photographerId,
  })
}

export function usePhotographerEvents(photographerId: string | undefined) {
  return useQuery({
    queryKey: ['photographer-events', photographerId],
    queryFn: async (): Promise<PublicEvent[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*, event_points(*), photographer:profiles(display_name)')
        .eq('photographer_id', photographerId)
        .order('event_date', { ascending: false })
      if (error) throw error
      return (data as unknown as PublicEvent[]) ?? []
    },
    enabled: !!photographerId,
  })
}

export function usePhotographerPhotos(photographerId: string | undefined) {
  return useQuery({
    queryKey: ['photographer-photos', photographerId],
    queryFn: async (): Promise<DbPhoto[]> => {
      const { data, error } = await supabase.from('photos').select('*').eq('photographer_id', photographerId)
      if (error) throw error
      return (data as DbPhoto[]) ?? []
    },
    enabled: !!photographerId,
  })
}

/** Búsqueda de fotos con filtros — trae todas y filtra en cliente (volumen bajo por ahora). */
export function useSearchPhotos(filters: SearchFilters) {
  return useQuery({
    queryKey: ['search-photos'],
    queryFn: async (): Promise<PublicPhoto[]> => {
      const { data, error } = await supabase
        .from('photos')
        .select('*, event:events(title, city, category), photographer:profiles(display_name)')
      if (error) throw error
      return (data as unknown as PublicPhoto[]) ?? []
    },
    select: (photos) => {
      let results = photos.filter((p) => {
        if (filters.photographerId && p.photographer_id !== filters.photographerId) return false
        if (filters.eventId && p.event_id !== filters.eventId) return false
        if (filters.pointId && p.point_id !== filters.pointId) return false
        if (filters.motoBrand && p.moto_brand !== filters.motoBrand) return false
        if (filters.city && p.event?.city !== filters.city) return false
        if (filters.category && p.event?.category !== filters.category) return false
        if (filters.query) {
          const q = filters.query.toLowerCase()
          const haystack = [p.event?.title, p.event?.city, p.photographer?.display_name].join(' ').toLowerCase()
          if (!haystack.includes(q)) return false
        }
        return true
      })
      if (filters.sort === 'precio-asc') results = [...results].sort((a, b) => a.price - b.price)
      if (filters.sort === 'precio-desc') results = [...results].sort((a, b) => b.price - a.price)
      return results
    },
  })
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function pointMatchesTime(point: DbEventPoint, afterTime?: string, beforeTime?: string) {
  if (!afterTime && !beforeTime) return true
  const start = timeToMinutes(point.time_start)
  if (afterTime && start < timeToMinutes(afterTime)) return false
  if (beforeTime && start > timeToMinutes(beforeTime)) return false
  return true
}

/** Todos los puntos de cobertura (para el mapa), con evento + fotógrafo embebidos. */
export function useMapPoints() {
  return useQuery({
    queryKey: ['map-points'],
    queryFn: async (): Promise<MapPoint[]> => {
      const { data, error } = await supabase
        .from('event_points')
        .select('*, event:events(id, title, city, photographer_id, photographer:profiles(display_name))')
      if (error) throw error
      return (data as unknown as MapPoint[]) ?? []
    },
  })
}
