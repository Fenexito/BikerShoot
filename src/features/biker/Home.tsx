import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { events, photographers } from '../../data/mockPhotos'
import { EventCard } from './components/EventCard'
import { PhotographerCard } from './components/PhotographerCard'
import { Button } from '../../ui/flat/Button'

export function Home() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const firstName = profile?.display_name?.split(' ')[0] || 'biker'
  const recentEvents = [...events].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 4)
  const featuredPhotographers = photographers.slice(0, 6)

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    navigate(query ? `/app/buscar?q=${encodeURIComponent(query)}` : '/app/buscar')
  }

  return (
    <div className="font-flat">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary px-6 py-20 text-white md:px-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute bottom-0 left-10 h-40 w-40 rotate-12 bg-white/10" />
        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">Hola, {firstName} 👋</h1>
          <p className="mt-3 text-lg text-white/90">¿Qué foto andas buscando hoy?</p>

          <form onSubmit={onSearch} className="mx-auto mt-8 flex max-w-xl gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca por evento, ciudad o fotógrafo..."
              className="h-14 flex-1 rounded-md border-0 bg-white px-5 text-base text-foreground outline-none focus:ring-2 focus:ring-white"
            />
            <Button type="submit" size="lg" className="bg-white text-primary hover:bg-white/90">
              Buscar
            </Button>
          </form>
        </div>
      </section>

      {/* Eventos recientes */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:px-16">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Eventos recientes</h2>
          <Link to="/app/eventos" className="text-sm font-semibold text-primary">
            Ver todos →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {recentEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>

      {/* Fotógrafos destacados */}
      <section className="bg-muted px-6 py-16 md:px-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Fotógrafos destacados</h2>
            <Link to="/app/fotografos" className="text-sm font-semibold text-primary">
              Ver todos →
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {featuredPhotographers.map((p) => (
              <PhotographerCard key={p.id} photographer={p} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA búsqueda avanzada */}
      <section className="mx-auto max-w-6xl px-6 py-16 text-center md:px-16">
        <h2 className="text-2xl font-bold tracking-tight">¿Buscas algo más específico?</h2>
        <p className="mt-2 text-muted-foreground">
          Filtra por marca de moto, fecha, ubicación y más en la búsqueda avanzada.
        </p>
        <Link to="/app/buscar">
          <Button size="lg" className="mt-6">
            Ir a búsqueda avanzada
          </Button>
        </Link>
      </section>
    </div>
  )
}
