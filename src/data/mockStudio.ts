// Datos de mentira para diseñar el portal del fotógrafo (Studio) sin tocar
// Supabase todavía. Representa "tu estudio" — no depende de la sesión real.

export interface StudioPoint {
  id: string
  label: string
  lat: number
  lng: number
  timeStart: string
  timeEnd: string
}

export interface StudioEvent {
  id: string
  title: string
  category: 'Rodada' | 'Pista' | 'Exhibición' | 'Concentración'
  city: string
  venue: string
  date: string
  pricePerPhoto: number
  description: string
  status: 'activo' | 'cerrado'
  photosCount: number
  salesCount: number
  coverSeed: string
  points: StudioPoint[]
}

export type OrderStatus = 'pendiente_pago' | 'activo' | 'finalizado' | 'entregado' | 'cancelado'

export interface OrderItem {
  photoSeed: string
  price: number
}

export interface Order {
  id: string
  bikerName: string
  bikerAvatarSeed: string
  eventId: string
  eventTitle: string
  items: OrderItem[]
  total: number
  status: OrderStatus
  paymentMethod: 'tarjeta' | 'transferencia'
  createdAt: string
}

function seededRandom(seed: number) {
  let value = seed
  return () => {
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
}
const rand = seededRandom(7)

export const studioEvents: StudioEvent[] = [
  {
    id: 'se1',
    title: 'Rodada Nocturna Antigua',
    category: 'Rodada',
    city: 'Antigua',
    venue: 'Punto de salida — Calzada Roosevelt',
    date: new Date(Date.now() - 3 * 86400000).toISOString(),
    pricePerPhoto: 25,
    description: 'Cobertura completa del evento: salida, ruta, paradas y llegada.',
    status: 'activo',
    photosCount: 340,
    salesCount: 128,
    coverSeed: 'event-cover-1',
    points: [
      { id: 'se1-pt1', label: 'Salida — Calzada Roosevelt', lat: 14.6134, lng: -90.5673, timeStart: '05:00', timeEnd: '05:30' },
      { id: 'se1-pt2', label: 'Km 15 — Carretera a Antigua', lat: 14.5934, lng: -90.6312, timeStart: '05:30', timeEnd: '06:00' },
      { id: 'se1-pt3', label: 'Llegada — Parque Central Antigua', lat: 14.5586, lng: -90.7295, timeStart: '06:00', timeEnd: '06:30' },
    ],
  },
  {
    id: 'se2',
    title: 'Track Day Autódromo Pedro Cofiño',
    category: 'Pista',
    city: 'Escuintla',
    venue: 'Autódromo Pedro Cofiño',
    date: new Date(Date.now() - 10 * 86400000).toISOString(),
    pricePerPhoto: 30,
    description: 'Tandas de la mañana y la tarde, curva 4 y recta principal.',
    status: 'cerrado',
    photosCount: 512,
    salesCount: 201,
    coverSeed: 'event-cover-2',
    points: [
      { id: 'se2-pt1', label: 'Curva 4', lat: 14.305, lng: -90.785, timeStart: '08:00', timeEnd: '10:00' },
      { id: 'se2-pt2', label: 'Recta principal', lat: 14.307, lng: -90.783, timeStart: '10:00', timeEnd: '12:00' },
    ],
  },
  {
    id: 'se3',
    title: 'Rodada Amanecer en la Costa',
    category: 'Rodada',
    city: 'Escuintla',
    venue: 'Punto de salida — Ruta al Pacífico',
    date: new Date(Date.now() + 5 * 86400000).toISOString(),
    pricePerPhoto: 20,
    description: 'Salida antes del amanecer, cobertura hasta playa.',
    status: 'activo',
    photosCount: 0,
    salesCount: 0,
    coverSeed: 'event-cover-8',
    points: [
      { id: 'se3-pt1', label: 'Salida — Km 0', lat: 14.5842, lng: -90.5501, timeStart: '04:30', timeEnd: '05:00' },
    ],
  },
]

const BIKER_NAMES = ['Carlos Méndez', 'Fernanda Ruiz', 'José Alvarado', 'Paola Cifuentes', 'Andrés Girón', 'Lucía Morales', 'Byron Castillo', 'Wendy Solís']
const STATUSES: OrderStatus[] = ['pendiente_pago', 'activo', 'finalizado', 'entregado', 'entregado', 'entregado']

export const orders: Order[] = Array.from({ length: 22 }, (_, i) => {
  const event = studioEvents[i % 2] // solo eventos con fotos
  const itemCount = 1 + Math.floor(rand() * 5)
  const items: OrderItem[] = Array.from({ length: itemCount }, (_, j) => ({
    photoSeed: `order-${i}-${j}`,
    price: event.pricePerPhoto,
  }))
  const daysAgo = Math.floor(rand() * 20)
  return {
    id: `o${i + 1}`,
    bikerName: BIKER_NAMES[i % BIKER_NAMES.length],
    bikerAvatarSeed: `biker-avatar-${i % BIKER_NAMES.length}`,
    eventId: event.id,
    eventTitle: event.title,
    items,
    total: items.reduce((sum, it) => sum + it.price, 0),
    status: STATUSES[i % STATUSES.length],
    paymentMethod: i % 3 === 0 ? 'transferencia' : 'tarjeta',
    createdAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
  }
})

export function thumbUrlStudio(seed: string, w = 400, h = 500) {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`
}

export function getStudioEventById(id: string) {
  return studioEvents.find((e) => e.id === id)
}

export function getOrderById(id: string) {
  return orders.find((o) => o.id === id)
}

export function getOrdersByStatus(status?: OrderStatus) {
  if (!status) return orders
  return orders.filter((o) => o.status === status)
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pendiente_pago: 'Pendiente de pago',
  activo: 'En proceso',
  finalizado: 'Finalizado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}
