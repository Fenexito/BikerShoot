import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePublicPhotographer, usePhotographerEvents, usePhotographerPhotos } from './usePublicData'
import { EventCard } from './components/EventCard'
import { PhotoGrid, type GridPhoto } from './components/PhotoGrid'
import { PhotoLightbox } from './components/PhotoLightbox'
import { Button } from '../../ui/flat/Button'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { PlaceholderPage } from '../auth/PlaceholderPage'

export function PhotographerProfile() {
  const { id } = useParams()
  const { data: photographer, isLoading } = usePublicPhotographer(id)
  const { data: events = [] } = usePhotographerEvents(id)
  const { data: photos = [] } = usePhotographerPhotos(id)
  const [tab, setTab] = useState<'fotos' | 'eventos'>('fotos')
  const [lightbox, setLightbox] = useState<{ photos: GridPhoto[]; index: number } | null>(null)

  if (isLoading) return <div className="px-6 py-16 text-center text-muted-foreground font-flat">Cargando…</div>
  if (!photographer) return <PlaceholderPage title="Fotógrafo no encontrado" />

  const gridPhotos: GridPhoto[] = photos.map((p) => {
    const event = events.find((e) => e.id === p.event_id)
    return { ...p, eventTitle: event?.title ?? '', photographerName: photographer.display_name }
  })

  return (
    <div className="font-flat">
      <div className="relative flex h-48 items-center justify-center bg-gradient-to-br from-blue-200 to-emerald-200 md:h-64">
        <span className="text-6xl opacity-30">🏍️</span>
      </div>

      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <div className="-mt-14 flex flex-col items-center gap-4 sm:flex-row sm:items-end">
          <InitialsAvatar
            name={photographer.display_name}
            className="h-28 w-28 rounded-full border-4 border-background bg-primary text-3xl text-white"
          />
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold tracking-tight">{photographer.display_name}</h1>
            {photographer.city && <p className="text-muted-foreground">{photographer.city}</p>}
          </div>
          <Button size="lg">Contactar</Button>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 rounded-lg bg-muted p-6 text-center">
          <div>
            <p className="text-2xl font-bold">{events.length}</p>
            <p className="text-sm text-muted-foreground">Eventos</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{photos.length}</p>
            <p className="text-sm text-muted-foreground">Fotos</p>
          </div>
        </div>

        {photographer.bio && <p className="mt-6 max-w-2xl text-muted-foreground">{photographer.bio}</p>}

        <div className="mt-8 flex gap-2 border-b border-border">
          <button
            onClick={() => setTab('fotos')}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${tab === 'fotos' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          >
            Fotos destacadas
          </button>
          <button
            onClick={() => setTab('eventos')}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${tab === 'eventos' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          >
            Eventos ({events.length})
          </button>
        </div>

        <div className="py-8">
          {tab === 'fotos' ? (
            <PhotoGrid photos={gridPhotos} onOpenPhoto={(photos, index) => setLightbox({ photos, index })} />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>

        <p className="pb-8 text-center text-sm text-muted-foreground">
          ¿Buscas más de {photographer.display_name}?{' '}
          <Link to={`/app/buscar?fotografo=${photographer.id}`} className="font-semibold text-primary">
            Ver todas sus fotos en la búsqueda
          </Link>
        </p>
      </div>

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(index) => setLightbox({ photos: lightbox.photos, index })}
        />
      )}
    </div>
  )
}
