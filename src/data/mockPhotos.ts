// Datos de mentira para diseñar el portal biker sin tocar Supabase todavía.
// Las imágenes son placeholders deterministas (picsum) — se reemplazan por
// storage real en la Fase 2.

export interface Photographer {
  id: string
  name: string
  city: string
  bio: string
  rating: number
  eventsCount: number
  photosCount: number
  yearsActive: number
  verified: boolean
  coverSeed: string
  avatarSeed: string
}

export interface MotoEvent {
  id: string
  title: string
  date: string
  city: string
  venue: string
  category: 'Rodada' | 'Pista' | 'Exhibición' | 'Concentración'
  photographerId: string
  coverSeed: string
  pricePerPhoto: number
  description: string
}

export interface Photo {
  id: string
  eventId: string
  photographerId: string
  seed: string
  price: number
  motoBrand: string
}

const CITIES = ['Guatemala', 'Antigua', 'Escuintla', 'Quetzaltenango', 'Chimaltenango']
const MOTO_BRANDS = ['Yamaha', 'Honda', 'Kawasaki', 'Suzuki', 'KTM', 'BMW', 'Ducati']
const CATEGORIES: MotoEvent['category'][] = ['Rodada', 'Pista', 'Exhibición', 'Concentración']

export const photographers: Photographer[] = [
  { id: 'p1', name: 'Luis Marroquín', city: 'Guatemala', bio: 'Cubro rodadas y eventos de pista desde 2017. Especialista en paneos y fotografía de acción.', rating: 4.9, eventsCount: 38, photosCount: 6200, yearsActive: 7, verified: true, coverSeed: 'ph-cover-1', avatarSeed: 'ph-avatar-1' },
  { id: 'p2', name: 'Ana Recinos', city: 'Antigua', bio: 'Fotografía de motociclismo y retratos en ruta. Me encanta capturar el momento exacto de la curva.', rating: 4.8, eventsCount: 25, photosCount: 4100, yearsActive: 4, verified: true, coverSeed: 'ph-cover-2', avatarSeed: 'ph-avatar-2' },
  { id: 'p3', name: 'Diego Estrada', city: 'Escuintla', bio: 'Especialista en pista y drift. Equipo profesional, entrega en 48 horas.', rating: 4.7, eventsCount: 19, photosCount: 3300, yearsActive: 3, verified: true, coverSeed: 'ph-cover-3', avatarSeed: 'ph-avatar-3' },
  { id: 'p4', name: 'Mariana López', city: 'Quetzaltenango', bio: 'Cubro concentraciones y exhibiciones en el occidente del país.', rating: 4.6, eventsCount: 14, photosCount: 2100, yearsActive: 2, verified: false, coverSeed: 'ph-cover-4', avatarSeed: 'ph-avatar-4' },
  { id: 'p5', name: 'Kevin Paz', city: 'Chimaltenango', bio: 'Fotografía deportiva y de acción. Ex-piloto, entiendo el ángulo que buscas.', rating: 4.9, eventsCount: 31, photosCount: 5400, yearsActive: 6, verified: true, coverSeed: 'ph-cover-5', avatarSeed: 'ph-avatar-5' },
  { id: 'p6', name: 'Sofía Ramírez', city: 'Guatemala', bio: 'Cubro rodadas nocturnas y eventos benéficos. Entrega con marca de agua removible.', rating: 4.5, eventsCount: 11, photosCount: 1800, yearsActive: 2, verified: false, coverSeed: 'ph-cover-6', avatarSeed: 'ph-avatar-6' },
]

const EVENT_TITLES = [
  'Rodada Nocturna Antigua',
  'Track Day Autódromo Pedro Cofiño',
  'Concentración Harley GT',
  'Exhibición Custom Bikes',
  'Rodada Solidaria Ruta al Pacífico',
  'Track Day Nocturno',
  'Encuentro Sport Bikes',
  'Rodada Amanecer en la Costa',
]

function seededRandom(seed: number) {
  let value = seed
  return () => {
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
}

const rand = seededRandom(42)

export const events: MotoEvent[] = EVENT_TITLES.map((title, i) => {
  const photographer = photographers[i % photographers.length]
  const daysAgo = Math.floor(rand() * 60) - 10
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
  return {
    id: `e${i + 1}`,
    title,
    date: date.toISOString(),
    city: CITIES[i % CITIES.length],
    venue: i % 3 === 0 ? 'Autódromo Pedro Cofiño' : 'Punto de salida — Calzada Roosevelt',
    category: CATEGORIES[i % CATEGORIES.length],
    photographerId: photographer.id,
    coverSeed: `event-cover-${i + 1}`,
    pricePerPhoto: [25, 30, 35, 20][i % 4],
    description:
      'Cobertura completa del evento: salida, ruta, paradas y llegada. Fotos en alta resolución, listas para descargar apenas las compres.',
  }
})

export const photos: Photo[] = events.flatMap((event, eIdx) => {
  const count = 14 + Math.floor(rand() * 18)
  return Array.from({ length: count }, (_, i) => ({
    id: `${event.id}-photo-${i + 1}`,
    eventId: event.id,
    photographerId: event.photographerId,
    seed: `photo-${eIdx}-${i}`,
    price: event.pricePerPhoto,
    motoBrand: MOTO_BRANDS[Math.floor(rand() * MOTO_BRANDS.length)],
  }))
})

export function thumbUrl(seed: string, w = 400, h = 500) {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`
}

export function getPhotographerById(id: string) {
  return photographers.find((p) => p.id === id)
}

export function getEventById(id: string) {
  return events.find((e) => e.id === id)
}

export function getPhotosByEvent(eventId: string) {
  return photos.filter((p) => p.eventId === eventId)
}

export function getEventsByPhotographer(photographerId: string) {
  return events.filter((e) => e.photographerId === photographerId)
}

export interface SearchFilters {
  query?: string
  photographerId?: string
  eventId?: string
  city?: string
  motoBrand?: string
  category?: MotoEvent['category']
  sort?: 'relevancia' | 'fecha' | 'precio-asc' | 'precio-desc'
}

export function searchPhotos(filters: SearchFilters): Photo[] {
  let results = [...photos]

  if (filters.photographerId) results = results.filter((p) => p.photographerId === filters.photographerId)
  if (filters.eventId) results = results.filter((p) => p.eventId === filters.eventId)
  if (filters.motoBrand) results = results.filter((p) => p.motoBrand === filters.motoBrand)

  if (filters.city || filters.category || filters.query) {
    const matchingEventIds = new Set(
      events
        .filter((e) => {
          if (filters.city && e.city !== filters.city) return false
          if (filters.category && e.category !== filters.category) return false
          if (filters.query && !e.title.toLowerCase().includes(filters.query.toLowerCase())) return false
          return true
        })
        .map((e) => e.id),
    )
    results = results.filter((p) => matchingEventIds.has(p.eventId))
  }

  if (filters.sort === 'precio-asc') results.sort((a, b) => a.price - b.price)
  if (filters.sort === 'precio-desc') results.sort((a, b) => b.price - a.price)

  return results
}
