import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePublicEvents, useApprovedPhotographers, useSearchPhotos } from './usePublicData'
import { previewUrl, r2Url } from '../../lib/r2'
import { EventCard } from './components/EventCard'
import { PhotographerCard } from './components/PhotographerCard'
import { Button } from '../../ui/flat/Button'

const COLLAGE_SPANS = [
  'col-span-2 row-span-2',
  'col-span-1 row-span-1',
  'col-span-1 row-span-2',
  'col-span-2 row-span-1',
  'col-span-1 row-span-1',
  'col-span-1 row-span-1',
  'col-span-2 row-span-1',
  'col-span-1 row-span-2',
  'col-span-1 row-span-1',
  'col-span-2 row-span-2',
]

export function Home() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const { data: events = [] } = usePublicEvents()
  const { data: photographers = [] } = useApprovedPhotographers()
  const { data: photos = [] } = useSearchPhotos({})

  const firstName = profile?.display_name?.split(' ')[0] || 'biker'
  const sortedEvents = [...events].sort((a, b) => +new Date(b.event_date) - +new Date(a.event_date))
  const featuredEvent = sortedEvents[0]
  const recentEvents = sortedEvents.slice(1, 5)

  const collagePhotos = useMemo(() => {
    if (photos.length === 0) return []
    const step = Math.max(1, Math.floor(photos.length / 10))
    return Array.from({ length: Math.min(10, photos.length) }, (_, i) => photos[(i * step) % photos.length])
  }, [photos])

  const cities = new Set(events.map((e) => e.city))
  const stats = [
    { value: photos.length, label: 'Fotos disponibles' },
    { value: photographers.length, label: 'Fotógrafos activos' },
    { value: events.length, label: 'Eventos cubiertos' },
    { value: cities.size, label: 'Ciudades' },
  ]

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    navigate(query ? `/app/buscar?q=${encodeURIComponent(query)}` : '/app/buscar')
  }

  return (
    <div className="font-flat">
      {/* Hero — collage de fotos reales de fondo */}
      <section className="relative isolate flex min-h-[560px] items-center overflow-hidden bg-primary md:min-h-[640px]">
        {collagePhotos.length > 0 && (
          <div className="absolute inset-0 grid grid-cols-4 grid-rows-3 gap-1 md:grid-cols-6">
            {collagePhotos.map((photo, i) => (
              <img
                key={photo.id}
                src={previewUrl(photo)}
                alt=""
                className={`h-full w-full object-cover ${COLLAGE_SPANS[i % COLLAGE_SPANS.length]}`}
                loading="eager"
              />
            ))}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/80 via-black/60 to-background" />

        <div className="relative mx-auto max-w-3xl px-6 text-center text-white md:px-16">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur">
            🏍️ Fotos nuevas todas las semanas
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Hola {firstName}, tu próxima<br className="hidden md:block" /> mejor foto está aquí
          </h1>
          <p className="mt-4 text-lg text-white/85">Búscala por evento, ruta o fotógrafo en segundos.</p>

          <form onSubmit={onSearch} className="mx-auto mt-8 flex max-w-xl gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca por evento, ciudad o fotógrafo..."
              className="h-14 flex-1 rounded-full border-0 bg-white px-5 text-base text-foreground shadow-lg outline-none focus:ring-2 focus:ring-white"
            />
            <Button type="submit" size="lg" className="bg-white text-primary shadow-lg hover:bg-white/90">
              Buscar
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
            <Link to="/app/mapa" className="rounded-full bg-white/15 px-4 py-2 font-semibold backdrop-blur transition-colors hover:bg-white/25">
              🗺️ Buscar por mapa de ruta
            </Link>
            <Link to="/app/eventos" className="rounded-full bg-white/15 px-4 py-2 font-semibold backdrop-blur transition-colors hover:bg-white/25">
              📅 Ver eventos
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border bg-background px-6 py-8 md:px-16">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 text-center md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-extrabold tracking-tight text-primary">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Momentos recientes */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:px-16">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Momentos recientes</h2>
          <Link to="/app/eventos" className="text-sm font-semibold text-primary">
            Ver todos →
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
            <span className="text-4xl opacity-40">📅</span>
            <p className="font-semibold">Todavía no hay eventos publicados</p>
            <p className="text-sm text-muted-foreground">Vuelve pronto o explora fotógrafos mientras tanto.</p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {featuredEvent && (
              <div className="lg:col-span-2 lg:row-span-2">
                <Link to={`/app/eventos/${featuredEvent.id}`} className="group block h-full overflow-hidden rounded-3xl border border-border bg-muted transition-all hover:border-primary/30 hover:shadow-sm">
                  <div className="relative flex h-72 items-center justify-center overflow-hidden bg-gradient-to-br from-blue-100 to-emerald-100 lg:h-full">
                    {featuredEvent.cover_path ? (
                      <img src={r2Url(featuredEvent.cover_path)} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <span className="text-6xl opacity-30">🏍️</span>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                      <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
                        {featuredEvent.status === 'activo' ? 'Activo' : 'Cerrado'}
                      </span>
                      <h3 className="mt-3 text-2xl font-extrabold tracking-tight md:text-3xl">{featuredEvent.title}</h3>
                      <p className="mt-1 text-white/85">{featuredEvent.city} · desde Q{featuredEvent.price_per_photo} por foto</p>
                    </div>
                  </div>
                </Link>
              </div>
            )}
            {recentEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      {/* Fotógrafos destacados */}
      <section className="bg-muted px-6 py-16 md:px-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Fotógrafos destacados</h2>
            <Link to="/app/fotografos" className="text-sm font-semibold text-primary">
              Ver todos →
            </Link>
          </div>
          {photographers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-background py-16 text-center">
              <span className="text-4xl opacity-40">📷</span>
              <p className="font-semibold">Todavía no hay fotógrafos aprobados</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {photographers.map((p) => (
                <PhotographerCard key={p.id} photographer={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Tres caminos */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:px-16">
        <h2 className="mb-8 text-center text-2xl font-bold tracking-tight md:text-3xl">¿Por dónde quieres empezar?</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <Link to="/app/buscar" className="group rounded-3xl border border-border bg-blue-50 p-8 text-center transition-all hover:shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm transition-transform duration-200 group-hover:scale-110">🔍</div>
            <h3 className="mt-4 text-lg font-bold">Búsqueda avanzada</h3>
            <p className="mt-1 text-sm text-muted-foreground">Filtra por marca de moto, fecha y más.</p>
          </Link>
          <Link to="/app/mapa" className="group rounded-3xl border border-border bg-emerald-50 p-8 text-center transition-all hover:shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm transition-transform duration-200 group-hover:scale-110">🗺️</div>
            <h3 className="mt-4 text-lg font-bold">Mapa de ruta</h3>
            <p className="mt-1 text-sm text-muted-foreground">Encuentra tu punto exacto por hora de salida.</p>
          </Link>
          <Link to="/app/fotografos" className="group rounded-3xl border border-border bg-amber-50 p-8 text-center transition-all hover:shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm transition-transform duration-200 group-hover:scale-110">📷</div>
            <h3 className="mt-4 text-lg font-bold">Explorar fotógrafos</h3>
            <p className="mt-1 text-sm text-muted-foreground">Descubre a quién seguir en tu ciudad.</p>
          </Link>
        </div>
      </section>
    </div>
  )
}
