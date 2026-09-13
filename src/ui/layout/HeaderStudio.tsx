import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { ThemeSwitcherInline } from '../studio/ThemeSwitcherInline'
import { useAuth } from '../../features/auth/AuthContext'
import { usePhotographerDetails } from '../../features/photographer/usePhotographerDetails'
import { r2Url } from '../../lib/r2'
import { IconArchive, IconCreditCard, IconImages, IconCart } from '../shared/icons'
import { AnimateIcon } from '../animate-icons/icon'
import { Search } from '../animate-icons/icons/Search'
import { UserRound } from '../animate-icons/icons/UserRound'
import { Settings } from '../animate-icons/icons/Settings'
import { Sparkles } from '../animate-icons/icons/Sparkles'
import { LogOut } from '../animate-icons/icons/LogOut'
import { CirclePlus } from '../animate-icons/icons/CirclePlus'
import { GlobalSearchModal } from '../../features/photographer/components/GlobalSearchModal'
import { InitialsAvatar } from '../shared/InitialsAvatar'
import { ProfileMenu } from '../shared/ProfileMenu'
import { NotificationsMenu } from '../shared/NotificationsMenu'
import { SocialLinks } from '../shared/SocialLinks'
import { MobileBottomNav } from '../shared/MobileBottomNav'
import { useAutoHideHeader } from '../shared/useAutoHideHeader'
import { useHeaderTransformStore } from './headerTransformStore'
import { HeaderBackSlot } from '../shared/HeaderBackSlot'
import { cn } from '../../lib/cn'

const NAV_ITEMS = [
  { to: '/studio/eventos', label: 'Eventos' },
  { to: '/studio/pedidos', label: 'Pedidos' },
  { to: '/studio/almacenamiento', label: 'Almacenamiento' },
  { to: '/studio/planes', label: 'Planes' },
]

export function HeaderStudio() {
  const { user, profile, signOut } = useAuth()
  const { data: details } = usePhotographerDetails(user?.id)
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      navigate('/')
    } finally {
      setSigningOut(false)
    }
  }

  const avatarUrl = profile?.avatar_url ? (profile.avatar_url.startsWith('http') ? profile.avatar_url : r2Url(profile.avatar_url)) : null
  const profileIncomplete = !!details && (!details.bio || !details.city || !details.whatsapp)
  const autoHidden = useAutoHideHeader()

  // El header se "transforma": si la página actual registró contenido y
  // señaló que ya toca mostrarlo (ver useHeaderTransform — cada página decide
  // su propio momento, ej. "la portada ya terminó de reducirse"), TODO lo
  // que hay a la derecha del botón atrás (logo, nav, notificaciones, perfil)
  // cede su lugar a las herramientas propias de esa página, con un
  // crossfade — el header nunca cambia de tamaño ni posición, solo lo que
  // hay adentro. Por defecto solo aplica en escritorio — una página puede
  // pedir `mobileEnabled` (ver headerTransformStore) para que también
  // aplique en móvil, igual que en HeaderUser.
  const transformContent = useHeaderTransformStore((s) => s.content)
  const transformActive = useHeaderTransformStore((s) => s.active)
  const mobileEnabled = useHeaderTransformStore((s) => s.mobileEnabled)
  const hideSearchTrigger = useHeaderTransformStore((s) => s.hideSearchTrigger)
  const actionsSlot = useHeaderTransformStore((s) => s.actionsSlot)
  const suppressAutoHide = useHeaderTransformStore((s) => s.suppressAutoHide)
  const transformed = transformActive && transformContent != null
  const hidden = suppressAutoHide ? false : autoHidden

  return (
    <>
      <div
        className={cn(
          'fixed inset-x-0 top-0 z-30 px-3 pt-3 transition-transform duration-300 md:sticky md:top-4 md:px-6 md:pt-0 md:!translate-y-0',
          hidden ? '-translate-y-[calc(100%+1rem)]' : 'translate-y-0',
        )}
      >
        <header className="mx-auto flex h-16 max-w-screen-xl items-center gap-4 rounded-full border border-border bg-background/90 px-4 shadow-sm backdrop-blur-md md:px-6">
          <HeaderBackSlot />
          <div className="relative h-10 min-w-0 flex-1">
            {/* Capa normal: logo + nav + notificaciones + perfil — sigue
                mostrándose completa en móvil (la transformación nunca aplica
                ahí), y en escritorio se desvanece cuando `transformed`. */}
            <div
              className={cn(
                'absolute inset-0 flex items-center gap-4 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                // OJO: cada rama de este ternario reemplaza el set COMPLETO
                // de clases de opacidad/traslado (nunca las agrega encima de
                // una base fija) — `cn` aquí es un simple `clsx`, SIN el
                // merge de `tailwind-merge`, así que dos utilidades que
                // apunten a la misma propiedad en el MISMO breakpoint (ej.
                // `opacity-100` y `opacity-0` sueltos, sin prefijo `md:` en
                // ninguna) quedan AMBAS en el string de clases a la vez, y
                // cuál "gana" depende del orden interno en el que Tailwind
                // generó el CSS, no del orden en que aparecen aquí — eso
                // exactamente causaba que en móvil (`mobileEnabled`, sin
                // prefijo `md:` de por medio) se vieran las dos capas
                // (normal y transformada) superpuestas al mismo tiempo.
                // Mismo patrón ya corregido en HeaderUser.tsx.
                transformed
                  ? mobileEnabled
                    ? 'pointer-events-none -translate-y-2.5 opacity-0'
                    : 'translate-y-0 opacity-100 md:pointer-events-none md:-translate-y-2.5 md:opacity-0'
                  : 'translate-y-0 opacity-100',
              )}
            >
              <Link to="/studio" className="shrink-0 font-studio text-lg font-bold tracking-tight2">
                MotoShots Studio
              </Link>
              <nav className="ml-2 hidden flex-1 items-center gap-1 text-sm font-medium md:flex">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'rounded-full px-3.5 py-2 transition-colors duration-150',
                        isActive ? 'bg-foreground/10 font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <AnimateIcon animateOnHover animateOnTap asChild>
                  <button
                    onClick={() => setSearchOpen(true)}
                    aria-label="Buscar en todo el sitio"
                    title="Buscar"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-border"
                  >
                    <Search size={20} />
                  </button>
                </AnimateIcon>
                <NotificationsMenu />
                <div className="hidden md:block">
                  <ProfileMenu
                    name={profile?.display_name ?? 'Estudio'}
                    email={user?.email}
                    avatar={
                      avatarUrl ? (
                        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <InitialsAvatar name={profile?.display_name ?? 'S'} className="h-full w-full bg-accent text-sm text-accent-foreground" />
                      )
                    }
                    socialLinks={
                      <SocialLinks
                        instagramUrl={details?.instagram_url}
                        facebookUrl={details?.facebook_url}
                        tiktokUrl={details?.tiktok_url}
                        iconClassName="text-white/50 hover:text-white"
                      />
                    }
                    editProfile={profileIncomplete ? { label: 'Completar perfil', to: '/studio/perfil' } : undefined}
                    themeSwitcher={<ThemeSwitcherInline />}
                    sections={[
                      [
                        { to: '/studio/perfil', label: 'Mi perfil', icon: <UserRound size={16} /> },
                        { to: '/studio/almacenamiento', label: 'Almacenamiento', icon: <IconArchive className="h-4 w-4" /> },
                        { to: '/studio/planes', label: 'Planes y facturación', icon: <IconCreditCard className="h-4 w-4" /> },
                      ],
                      [
                        { to: '/studio/ajustes', label: 'Configuración', icon: <Settings size={16} /> },
                        { to: '/changelog', label: 'Novedades', icon: <Sparkles size={16} /> },
                        { onClick: handleSignOut, label: signingOut ? 'Saliendo…' : 'Cerrar sesión', icon: <LogOut size={16} />, tone: 'danger' },
                      ],
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Capa transformada: por defecto solo existe en el DOM a partir
                de md — en móvil `hidden` la saca del todo, salvo que la
                página pida `mobileEnabled`, en cuyo caso está disponible
                siempre (igual que en HeaderUser). La búsqueda global se
                queda disponible aquí también (a la derecha, con forma de
                cuadro de búsqueda) — así nunca desaparece, sin importar qué
                página esté mostrando el header en ese momento. */}
            <div
              className={cn(
                'absolute inset-0 items-center gap-2 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                mobileEnabled ? 'flex' : 'hidden md:flex',
                transformed ? 'delay-100 translate-y-0 opacity-100' : 'pointer-events-none translate-y-2.5 opacity-0',
              )}
            >
              <div className="min-w-0 flex-1 overflow-hidden">{transformContent}</div>
              {/* Fuera del contenedor `overflow-hidden` de arriba a propósito
                  — un panel flotante (ej. el menú "···" de ActionMenu) que
                  viviera adentro quedaría recortado apenas se abriera. */}
              {actionsSlot}
              {/* Ancho fijo a propósito — igual al espacio que ocupan
                  buscar+notificaciones+perfil juntos en el estado normal
                  (40px+8px+40px+8px+40px = 176px), así el cambio se siente
                  contenido en vez de brusco. En móvil con `mobileEnabled` no
                  cabe junto al contenido de la página (que ya necesita todo
                  el ancho angosto disponible), así que se oculta ahí. Una
                  página como el detalle de un pedido lo oculta del todo con
                  `hideSearchTrigger` — ahí no aporta nada buscar. */}
              {!hideSearchTrigger && (
                <AnimateIcon animateOnHover animateOnTap asChild>
                  <button
                    onClick={() => setSearchOpen(true)}
                    className={cn(
                      'flex h-10 w-44 shrink-0 items-center gap-2 rounded-full bg-muted px-4 text-sm text-muted-foreground transition-colors hover:bg-border',
                      mobileEnabled && 'hidden sm:flex',
                    )}
                  >
                    <Search size={20} className="shrink-0" />
                    <span className="truncate">Buscar…</span>
                  </button>
                </AnimateIcon>
              )}
            </div>
          </div>
        </header>
      </div>

      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      <MobileBottomNav
        items={[
          { to: '/studio/eventos', label: 'Eventos', icon: <IconImages className="h-full w-full" /> },
          { to: '/studio/pedidos', label: 'Pedidos', icon: <IconCart className="h-full w-full" /> },
          { to: '/studio/almacenamiento', label: 'Espacio', icon: <IconArchive className="h-full w-full" /> },
          { to: '/studio/perfil', label: 'Perfil', icon: <UserRound className="h-full w-full" /> },
        ]}
        primary={{ to: '/studio/eventos/new', label: 'Crear', icon: <CirclePlus className="h-full w-full" /> }}
        activeClassName="text-accent"
        autoHide={mobileEnabled && !suppressAutoHide}
      />
    </>
  )
}
