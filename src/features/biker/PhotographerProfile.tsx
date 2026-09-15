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
import { IconVerified } from '../../ui/shared/icons'
import { AnimateIcon } from '../../ui/animate-icons/icon'
import { Whatsapp } from '../../ui/animate-icons/icons/Whatsapp'
import { PlaceholderPage } from '../auth/PlaceholderPage'
import { Skeleton } from '../../ui/shared/Skeleton'
import { useBackButton } from '../../ui/shared/useBackButton'
import { UnderlineTabs } from '../../ui/shared/Tabs'

export function PhotographerProfile() {
  const { id } = useParams()
  useBackButton('back')
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
        <div className="mx-auto max-w-6xl px-3 md:px-8">
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
          className="-mt-[4.25rem] md:-mt-20"
          src={coverUrl}
          alt={photographer.display_name}
          title={photographer.logo_path ? undefined : photographer.display_name}
          titleNode={
            photographer.logo_path ? (
              <img
                src={r2Url(photographer.logo_path)}
                alt={photographer.display_name}
                className="max-h-[60%] max-w-[80%] object-contain drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)]"
              />
            ) : undefined
          }
          scrollHint="Desliza para ver el perfil"
          useWindowScroll
          startWidth={60}
          startHeight={60}
          startRadius={36}
          endRadius={1}
          mediaZoom={1.5}
          scrollDistance={1}
          holdDistance={0.08}
          smoothing={0.3}
          overlayScrim={0.5}
        />
      ) : (
        <div className="relative flex h-48 items-center justify-center overflow-hidden bg-gradient-to-br from-blue-200 to-emerald-200 md:h-64">
          <span className="text-6xl opacity-30">🏍️</span>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-3 md:px-8">
        {/* Mismo estilo que el perfil del fotógrafo en su propio portal
            (StudioProfilePage.tsx) — avatar más grande superpuesto a la
            portada, encabezado más prominente. Sin la barra de
            almacenamiento, el botón de "Editar perfil" ni la cantidad de
            fotos subidas — ninguno de los 3 aplica del lado del biker; el
            botón de WhatsApp ocupa el mismo lugar que ahí ocupa "Editar". */}
        <div className="relative z-10 -mt-20 flex flex-col items-center gap-4 sm:flex-row sm:items-end md:-mt-24">
          {avatarUrl ? (
            <img src={avatarUrl} alt={photographer.display_name} className="h-36 w-36 shrink-0 rounded-full border-4 border-background object-cover shadow-sm md:h-40 md:w-40" />
          ) : (
            <InitialsAvatar
              name={photographer.display_name}
              className="h-36 w-36 shrink-0 rounded-full border-4 border-background bg-primary text-3xl text-white shadow-sm md:h-40 md:w-40"
            />
          )}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center gap-1.5 sm:justify-start">
              <h1 className="text-3xl font-bold tracking-tight">{photographer.display_name}</h1>
              <IconVerified className="h-6 w-6 shrink-0" aria-label="Fotógrafo verificado" />
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
            <AnimateIcon animateOnHover animateOnTap asChild>
              <a href={`https://wa.me/${photographer.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="hidden sm:inline-flex">
                <Button size="lg" style={{ backgroundColor: '#25D366' }}>
                  <Whatsapp size={20} />
                  Contactar por WhatsApp
                </Button>
              </a>
            </AnimateIcon>
          ) : (
            <Button size="lg" disabled className="hidden sm:inline-flex">Sin contacto</Button>
          )}
        </div>

        {/* Tarjeta con borde (mismo estilo que las tarjetas de stats del
            fotógrafo) — un solo dato (eventos cubiertos), sin cantidad de
            fotos ni almacenamiento. En móvil, el botón de WhatsApp (oculto
            arriba en esa vista) se repite al lado, mismo patrón que usa
            Studio con su botón "Editar" en móvil. */}
        <div className="mt-8 flex w-full items-center gap-3 sm:w-auto">
          <div className="animate-stat-in flex-1 rounded-3xl border border-border bg-card px-6 py-5 text-center sm:w-56 sm:flex-none">
            <p className="text-2xl font-bold">{events.length}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Evento{events.length === 1 ? '' : 's'} cubierto{events.length === 1 ? '' : 's'}</p>
          </div>
          {photographer.whatsapp ? (
            <AnimateIcon animateOnHover animateOnTap asChild>
              <a href={`https://wa.me/${photographer.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="shrink-0 sm:hidden">
                <Button size="sm" style={{ backgroundColor: '#25D366' }}>
                  <Whatsapp size={16} />
                  WhatsApp
                </Button>
              </a>
            </AnimateIcon>
          ) : (
            <Button size="sm" disabled className="shrink-0 sm:hidden">Sin contacto</Button>
          )}
        </div>

        {photographer.bio && <p className="mt-6 max-w-2xl text-muted-foreground">{photographer.bio}</p>}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-border">
          <UnderlineTabs
            tabs={[
              { value: 'fotos', label: 'Fotos destacadas' },
              { value: 'eventos', label: `Eventos (${events.length})` },
            ]}
            value={tab}
            onChange={setTab}
            className="flex gap-2"
            tabClassName="px-4 py-3 text-sm font-semibold transition-colors"
            activeClassName="text-primary"
            inactiveClassName="text-muted-foreground"
            indicatorClassName="bg-primary"
          />
          {tab === 'fotos' && (
            <div className="mb-2 flex gap-1 rounded-full bg-muted p-1">
              <button
                data-no-ripple
                onClick={() => setGalleryLayout('muro')}
                aria-label="Vista muro"
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${galleryLayout === 'muro' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              >
                ✦ Muro
              </button>
              <button
                data-no-ripple
                onClick={() => setGalleryLayout('grid')}
                aria-label="Vista cuadrícula"
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${galleryLayout === 'grid' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              >
                ▦ Grid
              </button>
              <button
                data-no-ripple
                onClick={() => setGalleryLayout('mosaic')}
                aria-label="Vista mosaico"
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${galleryLayout === 'mosaic' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              >
                ▤ Mosaico
              </button>
            </div>
          )}
        </div>

        <div key={tab} className="animate-tab-in py-8">
          {tab === 'fotos' ? (
            galleryLayout === 'muro' ? (
              featuredPhotos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Este fotógrafo todavía no ha destacado fotos en su perfil.</p>
              ) : (
                <div
                  className="w-screen"
                  style={{ height: '75vh', minHeight: 480, marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)' }}
                >
                  <DriftWall
                    items={featuredPhotos.map((p) => ({ image: previewUrl(p) }))}
                    columns={Math.max(3, Math.min(8, Math.floor(featuredPhotos.length / 4)))}
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
              {events.map((event, i) => (
                <div key={event.id} className="animate-card-in" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                  <EventCard event={event} />
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="pb-8 text-center text-sm text-muted-foreground">
          ¿Buscas más de {photographer.display_name}?{' '}
          <Link to={`/app/buscar?fotografos=${photographer.id}`} className="font-semibold text-primary">
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
