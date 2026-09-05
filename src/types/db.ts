// Formas de datos reales de Supabase, compartidas entre el portal biker y
// el portal fotógrafo — evita duplicar tipos entre features.

export type EventCategory = 'Rodada' | 'Pista' | 'Sesión de Fotos'
export type EventStatus = 'activo' | 'pausado' | 'cerrado'

export interface DbEventPoint {
  id: string
  event_id: string
  label: string
  lat: number
  lng: number
  time_start: string
  time_end: string
  route_point_id: string | null
}

export interface DbRoute {
  id: string
  name: string
}

export interface DbRoutePoint {
  id: string
  route_id: string
  label: string
  lat: number
  lng: number
}

export interface DbEvent {
  id: string
  photographer_id: string
  title: string
  category: EventCategory
  city: string
  venue: string | null
  event_date: string
  price_per_photo: number
  description: string | null
  status: EventStatus
  cover_path: string | null
  watermark_path: string | null
  deleted_at: string | null
  created_at: string
  event_points: DbEventPoint[]
}

export interface DbPhoto {
  id: string
  event_id: string
  photographer_id: string
  point_id: string | null
  storage_path: string | null
  preview_path: string | null
  raw_path: string | null
  delivered_path: string | null
  price: number
  moto_brand: string | null
  featured: boolean
  original_filename: string | null
  created_at: string
}

export interface DbPhotographer {
  id: string
  display_name: string
  avatar_url: string | null
  phone: string | null
  bio: string | null
  city: string | null
  whatsapp: string | null
  instagram_url: string | null
  facebook_url: string | null
  tiktok_url: string | null
  profile_cover_path: string | null
}
