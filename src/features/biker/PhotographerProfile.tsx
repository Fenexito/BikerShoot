import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPhotographerById, getEventsByPhotographer, photos as allPhotos, thumbUrl, type Photo } from '../../data/mockPhotos'
import { EventCard } from './components/EventCard'
import { PhotoGrid } from './components/PhotoGrid'
import { PhotoLightbox } from './components/PhotoLightbox'
import { Button } from '../../ui/flat/Button'
import { PlaceholderPage } from '../auth/PlaceholderPage'

export function PhotographerProfile() {
  const { id } = useParams()
  const photographer = getPhotographerById(id ?? '')
  const [tab, setTab] = useState<'fotos' | 'eventos'>('fotos')
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number } | null>(null)

  if (!photographer) return <PlaceholderPage title="Fotógrafo no encontrado" />

  const photographerEvents = getEventsByPhotographer(photographer.id)
  const photographerPhotos = allPhotos.filter((p) => p.photographerId === photographer.id)

  return (
    <div className="font-flat">
      <div className="relative h-48 md:h-64">
        <img src={thumbUrl(photographer.coverSeed, 1400, 400)} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <div className="-mt-14 flex flex-col items-center gap-4 sm:flex-row sm:items-end">
          <img
            src={thumbUrl(photographer.avatarSeed, 140, 140)}
            alt={photographer.name}
            className="h-28 w-28 rounded-full border-4 border-background object-cover"
          />
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-2xl font-bold tracking-tight">{photographer.name}</h1>
              {photographer.verified && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-white">✓</span>
              )}
            </div>
            <p className="text-muted-foreground">{photographer.city}</p>
          </div>
          <Button size="lg">Contactar</Button>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 rounded-lg bg-muted p-6 text-center">
          <div>
            <p className="text-2xl font-bold">{photographer.eventsCount}</p>
            <p className="text-sm text-muted-foreground">Eventos</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{photographer.photosCount.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Fotos</p>
          </div>
          <div>
            <p className="text-2xl font-bold">★ {photographer.rating}</p>
            <p className="text-sm text-muted-foreground">Calificación</p>
          </div>
        </div>

        <p className="mt-6 max-w-2xl text-muted-foreground">{photographer.bio}</p>

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
            Eventos ({photographerEvents.length})
          </button>
        </div>

        <div className="py-8">
          {tab === 'fotos' ? (
            <PhotoGrid photos={photographerPhotos} onOpenPhoto={(photos, index) => setLightbox({ photos, index })} />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {photographerEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>

        <p className="pb-8 text-center text-sm text-muted-foreground">
          ¿Buscas más de {photographer.name}?{' '}
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
