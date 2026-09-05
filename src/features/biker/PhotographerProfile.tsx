import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePublicPhotographer, usePhotographerEvents, useFeaturedPhotographerPhotos } from './usePublicData'
import { r2Url, previewUrl } from '../../lib/r2'
import { EventCard } from './components/EventCard'
import { PhotoGrid, type GridPhoto } from './components/PhotoGrid'
import { PhotoLightbox } from './components/PhotoLightbox'
import DriftWall from '../../ui/reactbits/DriftWall'
import ScrollExpand from '../../ui/reactbits/ScrollExpand'
import { Button } from '../../ui/flat/Button'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { SocialLinks } from '../../ui/shared/SocialLinks'
import { IconVerified, IconWhatsapp } from '../../ui/shared/icons'
import { PlaceholderPage } from '../auth/PlaceholderPage'
import { Skeleton } from '../../ui/shared/Skeleton'

export function PhotographerProfile() {
  const { id } = useParams()
  const { data: photographer, isLoading } = usePublicPhotographer(id)
  const { data: events = [] } = usePhotographerEvents(id)
  const { data: photos = [] } = useFeaturedPhotographerPhotos(id)
  const [tab, setTab] = useState<'fotos' | 'eventos'>('fotos')
  const [galleryLayout, setGalleryLayout] = useState<'grid' | 'mosaic' | 'muro'>('muro')
  const [lightbox, setLightbox] = useState<{ photos: GridPhoto[]; index: number } | null>(null)

  const featuredPhotos: GridPhoto[] = useMemo(() => {
    if (!photographer) return []
    return photos.map((p) => {
      const event = events.find((e) => e.id === p.event_id)
      return { ...p, eventTitle: event?.title ?? '', photographerName: photographer.display_name }
    })
  }, [photos, events, photographer])

  if (isLoading) {
    return (
      <div className="font-flat">
        <div className="h-48 w-full animate-pulse bg-muted md:h-64" />
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="-mt-14 flex items-end gap-4">
            <Skeleton className="h-28 w-28 shrink-0 rounded-full border-4 border-background" />
            <div className="flex-1 space-y-2 pb-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
      </div>
    )
  }
  if (!photographer) return <PlaceholderPage title="Fotógrafo no encontrado" />

  const avatarUrl = photographer.avatar_url
    ? (photographer.avatar_url.startsWith('http') ? photographer.avatar_url : r2Url(photographer.avatar_url))
    : null
  const coverUrl = photographer.profile_cover_path ? r2Url(photographer.profile_cover_path) : null

  return (
    <div className="font-flat">
      {coverUrl ? (
        <ScrollExpand
          src={coverUrl}
          alt={photographer.display_name}
          title={photographer.display_name}
          scrollHint="Desliza para ver el perfil"
          useWindowScroll
          startWidth={60}
          startHeight={60}
          startRadius={36}
          endRadius={1}
          mediaZoom={1.5}
          scrollDistance={1}
          holdDistance={0.45}
          smoothing={0.3}
          overlayScrim={0.5}
        />
      ) : (
        <div className="relative flex h-48 items-center justify-center overflow-hidden bg-gradient-to-br from-blue-200 to-emerald-200 md:h-64">
          <span className="text-6xl opacity-30">🏍️</span>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <div className="relative -mt-14 flex flex-col items-center gap-4 sm:flex-row sm:items-end">
          {avatarUrl ? (
            <img src={avatarUrl} alt={photographer.display_name} className="h-28 w-28 rounded-full border-4 border-background object-cover" />
          ) : (
            <InitialsAvatar
              name={photographer.display_name}
              className="h-28 w-28 rounded-full border-4 border-background bg-primary text-3xl text-white"
            />
          )}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center gap-1.5 sm:justify-start">
              <h1 className="text-2xl font-bold tracking-tight">{photographer.display_name}</h1>
              <IconVerified className="h-5 w-5 shrink-0" aria-label="Fotógrafo verificado" />
            </div>
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
              <Button size="lg" style={{ backgroundColor: '#25D366' }}>
                <IconWhatsapp className="h-5 w-5" />
                Contactar por WhatsApp
              </Button>
            </a>
          ) : (
            <Button size="lg" disabled>Sin contacto</Button>
          )}
        </div>

        <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-border bg-card px-6 py-3">
          <p className="text-2xl font-bold">{events.length}</p>
          <p className="text-sm text-muted-foreground">evento{events.length === 1 ? '' : 's'} cubierto{events.length === 1 ? '' : 's'}</p>
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
            <div className="mb-2 flex gap-1 rounded-full bg-muted p-1">
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
                <p className="text-sm text-muted-foreground">Este fotógrafo todavía no ha destacado fotos en su perfil.</p>
              ) : (
                <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen" style={{ height: '75vh', minHeight: 480 }}>
                  <DriftWall
                    items={featuredPhotos.map((p) => ({ image: previewUrl(p) }))}
                    columns={Math.min(8, Math.max(3, featuredPhotos.length))}
                    tileWidth={220}
                    tileHeight={220}
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
                    fade={0.15}
                    dim={0.92}
                    overlayColor="transparent"
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
