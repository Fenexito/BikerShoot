import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePhotographerDetails, usePhotographerUsageBytes } from './usePhotographerDetails'
import { usePublicPhotographer, useFeaturedPhotographerPhotos, usePhotographerPhotoCount } from '../biker/usePublicData'
import { useMyEvents } from './useMyEvents'
import { StudioEventCard } from './components/StudioEventCard'
import { r2Url, previewUrl } from '../../lib/r2'
import { Button } from '../../ui/studio/Button'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { SocialLinks } from '../../ui/shared/SocialLinks'
import { IconVerified } from '../../ui/shared/icons'
import { AnimateIcon } from '../../ui/animate-icons/icon'
import { CreditCard } from '../../ui/animate-icons/icons/CreditCard'
import { Settings } from '../../ui/animate-icons/icons/Settings'
import { LogOut } from '../../ui/animate-icons/icons/LogOut'
import { Edit } from '../../ui/animate-icons/icons/Edit'
import { ThemeToggle } from '../../ui/studio/ThemeToggle'
import { Skeleton } from '../../ui/shared/Skeleton'
import DriftWall from '../../ui/reactbits/DriftWall'
import ScrollExpand from '../../ui/reactbits/ScrollExpand'
import { cn } from '../../lib/cn'

function formatBytes(n: number) {
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(0)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/** Puramente visual — igual a como lo ve un biker en PhotographerProfile.tsx,
 * con la única diferencia de que aquí también se ve el conteo de fotos y el
 * uso de almacenamiento/plan. Toda edición (foto, portada, logo, bio, redes,
 * cuenta) vive en /studio/ajustes — "Editar perfil" solo lleva ahí. */
export function StudioProfilePage() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [tab, setTab] = useState<'destacadas' | 'eventos'>('destacadas')

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      navigate('/studio/login')
    } finally {
      setSigningOut(false)
    }
  }

  const { data: details } = usePhotographerDetails(user?.id)
  const { data: usageBytes = 0 } = usePhotographerUsageBytes(user?.id)
  const { data: photographer, isLoading } = usePublicPhotographer(user?.id)
  const { data: events = [] } = useMyEvents(user?.id)
  const { data: featuredPhotos = [] } = useFeaturedPhotographerPhotos(user?.id)
  const { data: photoCount = 0 } = usePhotographerPhotoCount(user?.id)

  if (isLoading || !profile || !photographer) {
    return (
      <div>
        <div className="h-48 w-full animate-pulse bg-muted md:h-64" />
        <div className={STUDIO_PAGE_WIDE}>
          <div className="-mt-16 flex items-end gap-4">
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

  const avatarUrl = profile.avatar_url ? (profile.avatar_url.startsWith('http') ? profile.avatar_url : r2Url(profile.avatar_url)) : null
  const coverUrl = details?.profile_cover_path ? r2Url(details.profile_cover_path) : null
  const limitBytes = details?.storage_plan ? details.storage_plan.gb_limit * 1024 * 1024 * 1024 : 0
  const pct = limitBytes > 0 ? Math.min(100, (usageBytes / limitBytes) * 100) : 0

  return (
    <div>
      {coverUrl ? (
        <ScrollExpand
          className="-mt-[4.75rem] md:-mt-20"
          src={coverUrl}
          alt={profile.display_name}
          title={details?.logo_path ? undefined : profile.display_name}
          titleNode={
            details?.logo_path ? (
              <img
                src={r2Url(details.logo_path)}
                alt={profile.display_name}
                className="max-h-[60%] max-w-[80%] object-contain drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)]"
              />
            ) : undefined
          }
          scrollHint="Desliza para ver tu perfil"
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
        <div className="flex h-48 items-center justify-center bg-muted md:h-64">
          <span className="text-6xl opacity-20">🏍️</span>
        </div>
      )}

      <div className={STUDIO_PAGE_WIDE}>
        {/* `relative z-10`: el stage de ScrollExpand queda "stuck" (position:
            sticky) durante todo el resto de su track, incluyendo el tramo
            donde el avatar debe traslaparlo — sin un z explícito, el avatar
            terminaba pintándose debajo una vez la portada quedaba fija. */}
        <div className="relative z-10 -mt-[136px] flex flex-col items-center gap-4 sm:flex-row sm:items-end">
          {avatarUrl ? (
            <img src={avatarUrl} alt={profile.display_name} className="h-44 w-44 shrink-0 rounded-full border-4 border-background object-cover shadow-sm" />
          ) : (
            <InitialsAvatar name={profile.display_name || 'S'} className="h-44 w-44 shrink-0 rounded-full border-4 border-background bg-foreground text-3xl text-background shadow-sm" />
          )}

          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <h1 className="font-studio text-3xl font-bold tracking-tight2">{profile.display_name}</h1>
              {details?.approved && <IconVerified className="h-6 w-6 shrink-0" aria-label="Fotógrafo verificado" />}
            </div>
            <p className="text-muted-foreground">{photographer.city || 'Sin ciudad configurada'}</p>
            <SocialLinks
              instagramUrl={photographer.instagram_url}
              facebookUrl={photographer.facebook_url}
              tiktokUrl={photographer.tiktok_url}
              className="mt-2 justify-center sm:justify-start"
            />
          </div>

          <AnimateIcon animateOnHover animateOnTap asChild>
            <Link to="/studio/ajustes" className="hidden sm:inline-flex">
              <Button variant="dark" className="gap-1.5">
                <Edit size={16} /> Editar perfil
              </Button>
            </Link>
          </AnimateIcon>
        </div>

        {!details?.approved && (
          <p className="mt-6 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Tu cuenta está en revisión. Podrás publicar eventos y vender fotos en cuanto un administrador la apruebe.
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-4">
          {/* `sm:contents` deja que estos dos hijos se comporten como si
              fueran hijos directos del `flex-wrap` de arriba en escritorio
              (donde el botón de abajo va oculto) — en móvil sí forman su
              propia fila, tarjeta + botón lado a lado. */}
          <div className="flex w-full items-center gap-3 sm:contents">
            <div className="animate-stat-in grid flex-1 grid-cols-2 gap-4 rounded-3xl border border-border bg-card px-4 py-5 text-center sm:w-72 sm:px-6">
              <div>
                <p className="text-2xl font-bold">{events.length}</p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Rodadas cubiertas</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{photoCount}</p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fotos publicadas</p>
              </div>
            </div>
            <Link to="/studio/ajustes" className="shrink-0 sm:hidden">
              <Button variant="dark" size="sm">Editar</Button>
            </Link>
          </div>

          {details?.storage_plan && (
            <div className="animate-stat-in flex-1 rounded-3xl border border-border bg-card px-6 py-5" style={{ minWidth: 240, animationDelay: '60ms' }}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Almacenamiento · Plan {details.storage_plan.name}
                </p>
                <Link to="/studio/planes" className="text-[11px] font-semibold uppercase tracking-wide text-foreground underline">
                  Ver planes →
                </Link>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full transition-all', pct > 90 ? 'bg-red-500' : 'bg-foreground')} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatBytes(usageBytes)} de {details.storage_plan.gb_limit} GB usados
                {pct > 90 && <span className="ml-1 font-semibold text-red-500">· casi sin espacio</span>}
              </p>
            </div>
          )}
        </div>

        {photographer.bio && <p className="mt-6 max-w-2xl text-muted-foreground">{photographer.bio}</p>}

        <div className="mt-8 flex flex-wrap gap-2">
          <button
            onClick={() => setTab('destacadas')}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              tab === 'destacadas' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-border hover:text-foreground',
            )}
          >
            Fotos destacadas
          </button>
          <button
            onClick={() => setTab('eventos')}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              tab === 'eventos' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-border hover:text-foreground',
            )}
          >
            Eventos ({events.length})
          </button>
        </div>

        <div key={tab} className="animate-tab-in py-8">
          {tab === 'destacadas' ? (
            featuredPhotos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no has destacado ninguna foto.</p>
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
                  radius={0}
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
                />
              </div>
            )
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event, i) => (
                <div key={event.id} className="animate-card-in" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                  <StudioEventCard event={event} photographerId={user?.id} />
                </div>
              ))}
              {events.length === 0 && <p className="text-sm text-muted-foreground">Todavía no tienes eventos.</p>}
            </div>
          )}
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 border-t border-border pt-8 md:hidden">
          <AnimateIcon animateOnHover animateOnTap asChild>
            <Link
              to="/studio/planes"
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-3 py-4 text-center text-xs font-medium transition-colors hover:border-accent/40"
            >
              <CreditCard size={20} />
              Planes y facturación
            </Link>
          </AnimateIcon>
          <AnimateIcon animateOnHover animateOnTap asChild>
            <Link
              to="/studio/ajustes"
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-3 py-4 text-center text-xs font-medium transition-colors hover:border-accent/40"
            >
              <Settings size={20} />
              Configuración
            </Link>
          </AnimateIcon>
        </div>
        <div className="mt-4 flex items-center justify-between md:hidden">
          <AnimateIcon animateOnHover animateOnTap asChild>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground disabled:opacity-50"
            >
              <LogOut size={16} />
              {signingOut ? 'Saliendo…' : 'Cerrar sesión'}
            </button>
          </AnimateIcon>
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
