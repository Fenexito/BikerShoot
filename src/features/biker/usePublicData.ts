import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { DbEvent, DbEventPoint, DbPhoto, DbPhotographer } from '../../types/db'

export interface PublicEventPoint extends DbEventPoint {
  route_point: { route_id: string } | null
}

export interface PublicEvent extends Omit<DbEvent, 'event_points'> {
  event_points: PublicEventPoint[]
  photographer: { display_name: string; photographer_details: { whatsapp: string | null }[] | { whatsapp: string | null } | null } | null
}

export interface PublicPhoto extends DbPhoto {
  event: { title: string; city: string; category: string; deleted_at: string | null; status: string } | null
  photographer: { display_name: string } | null
  point: { route_point: { route_id: string } | null } | null
}

export interface MapPoint extends DbEventPoint {
  event: {
    id: string
    title: string
    city: string
    photographer_id: string
    photographer: { display_name: string } | null
    deleted_at: string | null
    status: string
  } | null
  route_point: { route_id: string } | null
}

export interface SearchFilters {
  query?: string
  city?: string
  category?: string
  motoBrand?: string
  photographerId?: string
  eventId?: string
  pointId?: string
  routeId?: string
  sort?: 'relevancia' | 'precio-asc' | 'precio-desc'
}

/** Muestra liviana de fotos públicas para muros decorativos (login, landing) —
 * no trae datos de ningún fotógrafo en particular, solo variedad visual. */
export function usePublicPhotoSample(limit = 40) {
  return useQuery({
    queryKey: ['public-photo-sample', limit],
    queryFn: async (): Promise<{ preview_path: string | null; storage_path: string | null }[]> => {
      const { data, error } = await supabase
        .from('photos')
        .select('preview_path, storage_path')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}

/** Todos los eventos visibles públicamente (con sus puntos y el nombre del fotógrafo). */
export function usePublicEvents() {
  return useQuery({
    queryKey: ['public-events'],
    queryFn: async (): Promise<PublicEvent[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*, event_points(*, route_point:route_points(route_id)), photographer:profiles(display_name)')
        .is('deleted_at', null)
        .neq('status', 'pausado')
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
        .select('*, event_points(*, route_point:route_points(route_id)), photographer:profiles(display_name, photographer_details(whatsapp))')
        .eq('id', eventId)
        .is('deleted_at', null)
        .neq('status', 'pausado')
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
        .select('id, display_name, avatar_url, phone, photographer_details(bio, city, whatsapp, instagram_url, facebook_url, tiktok_url, profile_cover_path)')
        .eq('role', 'photographer')
      if (error) throw error
      return (data ?? []).map((row: any) => {
        const pd = row.photographer_details?.[0] ?? row.photographer_details
        return {
          id: row.id,
          display_name: row.display_name,
          avatar_url: row.avatar_url,
          phone: row.phone,
          bio: pd?.bio ?? null,
          city: pd?.city ?? null,
          whatsapp: pd?.whatsapp ?? null,
          instagram_url: pd?.instagram_url ?? null,
          facebook_url: pd?.facebook_url ?? null,
          tiktok_url: pd?.tiktok_url ?? null,
          profile_cover_path: pd?.profile_cover_path ?? null,
        }
      })
    },
  })
}

export function usePublicPhotographer(photographerId: string | undefined) {
  return useQuery({
    queryKey: ['public-photographer', photographerId],
    queryFn: async (): Promise<DbPhotographer | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, phone, photographer_details(bio, city, whatsapp, instagram_url, facebook_url, tiktok_url, profile_cover_path)')
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
        instagram_url: pd?.instagram_url ?? null,
        facebook_url: pd?.facebook_url ?? null,
        tiktok_url: pd?.tiktok_url ?? null,
        profile_cover_path: pd?.profile_cover_path ?? null,
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
        .select('*, event_points(*, route_point:route_points(route_id)), photographer:profiles(display_name)')
        .eq('photographer_id', photographerId)
        .is('deleted_at', null)
        .neq('status', 'pausado')
        .order('event_date', { ascending: false })
      if (error) throw error
      return (data as unknown as PublicEvent[]) ?? []
    },
    enabled: !!photographerId,
  })
}

/** Solo las fotos marcadas como destacadas — nunca "todas las fotos del
 * fotógrafo" (eso puede ser decenas de miles de filas). El fotógrafo elige
 * cuáles destacar al momento de entregarlas en un pedido, no aquí. */
export function useFeaturedPhotographerPhotos(photographerId: string | undefined) {
  return useQuery({
    queryKey: ['featured-photographer-photos', photographerId],
    queryFn: async (): Promise<DbPhoto[]> => {
      const { data, error } = await supabase
        .from('photos')
        .select('*, event:events(deleted_at, status)')
        .eq('photographer_id', photographerId)
        .eq('featured', true)
      if (error) throw error
      return (
        (data as unknown as (DbPhoto & { event: { deleted_at: string | null; status: string } | null })[]) ?? []
      ).filter((p) => !p.event?.deleted_at && p.event?.status !== 'pausado')
    },
    enabled: !!photographerId,
  })
}

/** Fotos destacadas de TODOS los fotógrafos, para el carrusel animado de la
 * tarjeta de evento en el visor — liviano porque "destacada" es un flag que
 * el fotógrafo cura a mano, nunca todas las fotos del evento (que pueden ser
 * miles). Se agrupan por event_id en el componente que las consume. */
export function useFeaturedEventPhotos() {
  return useQuery({
    queryKey: ['featured-event-photos'],
    queryFn: async (): Promise<DbPhoto[]> => {
      const { data, error } = await supabase
        .from('photos')
        .select('*, event:events(deleted_at, status)')
        .eq('featured', true)
      if (error) throw error
      return (
        (data as unknown as (DbPhoto & { event: { deleted_at: string | null; status: string } | null })[]) ?? []
      ).filter((p) => !p.event?.deleted_at && p.event?.status !== 'pausado')
    },
  })
}

/** Conteo liviano (sin traer las filas) para el stat "Fotos publicadas". */
export function usePhotographerPhotoCount(photographerId: string | undefined) {
  return useQuery({
    queryKey: ['photographer-photo-count', photographerId],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('photos')
        .select('id, event:events!inner(deleted_at, status)', { count: 'exact', head: true })
        .eq('photographer_id', photographerId)
        .is('event.deleted_at', null)
        .neq('event.status', 'pausado')
      if (error) throw error
      return count ?? 0
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
        .select('*, event:events(title, city, category, deleted_at, status), photographer:profiles(display_name), point:event_points(route_point:route_points(route_id))')
      if (error) throw error
      return (data as unknown as PublicPhoto[]) ?? []
    },
    select: (photos) => {
      let results = photos.filter((p) => {
        if (p.event?.deleted_at) return false
        if (p.event?.status === 'pausado') return false
        if (filters.photographerId && p.photographer_id !== filters.photographerId) return false
        if (filters.eventId && p.event_id !== filters.eventId) return false
        if (filters.pointId && p.point_id !== filters.pointId) return false
        if (filters.routeId && p.point?.route_point?.route_id !== filters.routeId) return false
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
        .select('*, event:events(id, title, city, photographer_id, photographer:profiles(display_name), deleted_at, status), route_point:route_points(route_id)')
      if (error) throw error
      return ((data as unknown as MapPoint[]) ?? []).filter((p) => !p.event?.deleted_at && p.event?.status !== 'pausado')
    },
  })
}
