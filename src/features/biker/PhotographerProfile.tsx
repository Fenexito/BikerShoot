import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePublicPhotographer, usePhotographerEvents, usePhotographerPhotos } from './usePublicData'
import { r2Url, previewUrl } from '../../lib/r2'
import { EventCard } from './components/EventCard'
import { PhotoGrid, type GridPhoto } from './components/PhotoGrid'
import { PhotoLightbox } from './components/PhotoLightbox'
import DriftWall from '../../ui/reactbits/DriftWall'
import { Button } from '../../ui/flat/Button'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { SocialLinks } from '../../ui/shared/SocialLinks'
import { PlaceholderPage } from '../auth/PlaceholderPage'

export function PhotographerProfile() {
  const { id } = useParams()
  const { data: photographer, isLoading } = usePublicPhotographer(id)
  const { data: events = [] } = usePhotographerEvents(id)
  const { data: photos = [] } = usePhotographerPhotos(id)
  const [tab, setTab] = useState<'fotos' | 'eventos'>('fotos')
  const [galleryLayout, setGalleryLayout] = useState<'grid' | 'mosaic' | 'muro'>('muro')
  const [lightbox, setLightbox] = useState<{ photos: GridPhoto[]; index: number } | null>(null)

  const gridPhotos: GridPhoto[] = useMemo(() => {
    if (!photographer) return []
    return photos.map((p) => {
      const event = events.find((e) => e.id === p.event_id)
      return { ...p, eventTitle: event?.title ?? '', photographerName: photographer.display_name }
    })
  }, [photos, events, photographer])

  // Si el fotógrafo no ha curado ninguna, mostramos todas para no dejar la pestaña vacía.
  const featuredPhotos = useMemo(() => {
    const featured = gridPhotos.filter((p) => p.featured)
    return featured.length > 0 ? featured : gridPhotos
  }, [gridPhotos])

  if (isLoading) return <div className="px-6 py-16 text-center text-muted-foreground font-flat">Cargando…</div>
  if (!photographer) return <PlaceholderPage title="Fotógrafo no encontrado" />

  const avatarUrl = photographer.avatar_url
    ? (photographer.avatar_url.startsWith('http') ? photographer.avatar_url : r2Url(photographer.avatar_url))
    : null

  return (
    <div className="font-flat">
      <div className="relative flex h-48 items-center justify-center bg-gradient-to-br from-blue-200 to-emerald-200 md:h-64">
        <span className="text-6xl opacity-30">🏍️</span>
      </div>

      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <div className="-mt-14 flex flex-col items-center gap-4 sm:flex-row sm:items-end">
          {avatarUrl ? (
            <img src={avatarUrl} alt={photographer.display_name} className="h-28 w-28 rounded-full border-4 border-background object-cover" />
          ) : (
            <InitialsAvatar
              name={photographer.display_name}
              className="h-28 w-28 rounded-full border-4 border-background bg-primary text-3xl text-white"
            />
          )}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold tracking-tight">{photographer.display_name}</h1>
            {photographer.city && <p className="text-muted-foreground">{photographer.city}</p>}
            <SocialLinks
              instagramUrl={photographer.instagram_url}
              facebookUrl={photographer.facebook_url}
              tiktokUrl={photographer.tiktok_url}
              className="mt-2 justify-center sm:justify-start"
            />
          </div>
          {photographer.whatsapp ? (
            <a href={`https://wa.me/${photographer.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer">
              <Button size="lg">Contactar por WhatsApp</Button>
            </a>
          ) : (
            <Button size="lg" disabled>Sin contacto</Button>
          )}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 rounded-lg bg-muted p-6 text-center">
          <div>
            <p className="text-2xl font-bold">{events.length}</p>
            <p className="text-sm text-muted-foreground">Rodadas cubiertas</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{photos.length}</p>
            <p className="text-sm text-muted-foreground">Fotos publicadas</p>
          </div>
        </div>

        {photographer.bio && <p className="mt-6 max-w-2xl text-muted-foreground">{photographer.bio}</p>}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-border">
          <div className="flex gap-2">
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
          {tab === 'fotos' && (
            <div className="mb-2 flex gap-1 rounded-md bg-muted p-1">
              <button
                onClick={() => setGalleryLayout('muro')}
                aria-label="Vista muro"
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${galleryLayout === 'muro' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              >
                ✦ Muro
              </button>
              <button
                onClick={() => setGalleryLayout('grid')}
                aria-label="Vista cuadrícula"
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${galleryLayout === 'grid' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              >
                ▦ Grid
              </button>
              <button
                onClick={() => setGalleryLayout('mosaic')}
                aria-label="Vista mosaico"
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${galleryLayout === 'mosaic' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              >
                ▤ Mosaico
              </button>
            </div>
          )}
        </div>

        <div className="py-8">
          {tab === 'fotos' ? (
            galleryLayout === 'muro' ? (
              featuredPhotos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Este fotógrafo todavía no tiene fotos publicadas.</p>
              ) : (
                <div style={{ height: 420 }}>
                  <DriftWall
                    items={featuredPhotos.map((p) => ({ image: previewUrl(p) }))}
                    columns={Math.min(7, Math.max(3, featuredPhotos.length))}
                    tileWidth={180}
                    tileHeight={180}
                    gap={6}
                    radius={12}
                    tilt={16}
                    turn={-14}
                    perspective={950}
                    depth={100}
                    speed={22}
                    variance={0.5}
                    parallax={0.5}
                    lift={48}
                    fade={0.25}
                    dim={0.75}
                    onItemClick={(_, index) => setLightbox({ photos: featuredPhotos, index })}
                  />
                </div>
              )
            ) : (
              <PhotoGrid photos={featuredPhotos} layout={galleryLayout} onOpenPhoto={(photos, index) => setLightbox({ photos, index })} />
            )
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
