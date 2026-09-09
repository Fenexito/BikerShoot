import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { useBikerDetails } from '../../features/biker/useBikerDetails'
import { useCartStore } from '../../features/cart/cartStore'
import { r2Url } from '../../lib/r2'
import { IconBookmark, IconCart, IconUser, IconLogOut, IconSearch, IconSparkles, IconHome, IconImages } from '../shared/icons'
import { InitialsAvatar } from '../shared/InitialsAvatar'
import { ProfileMenu } from '../shared/ProfileMenu'
import { NotificationsMenu } from '../shared/NotificationsMenu'
import { MobileBottomNav } from '../shared/MobileBottomNav'
import { useAutoHideHeader } from '../shared/useAutoHideHeader'
import { useHeaderTransformStore } from './headerTransformStore'
import { HeaderBackSlot } from '../shared/HeaderBackSlot'
import { BikerSearchModal } from '../../features/biker/components/BikerSearchModal'
import { cn } from '../../lib/cn'

// "Mis compras" ya NO vive aquí — vive únicamente en el menú de perfil
// (ver `sections` de `ProfileMenu` más abajo).
const NAV_ITEMS = [
  { to: '/app/buscar', label: 'Buscar fotos' },
  { to: '/app/mapa', label: 'Mapa' },
  { to: '/app/eventos', label: 'Eventos' },
  { to: '/app/fotografos', label: 'Fotógrafos' },
]

export function HeaderUser() {
  const { user, profile, signOut } = useAuth()
  const { data: bikerDetails } = useBikerDetails(user?.id)
  const navigate = useNavigate()
  const itemCount = useCartStore((s) => s.items.length)
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
  const hidden = useAutoHideHeader()

  // Mismo mecanismo que HeaderStudio: si la página actual registró
  // contenido y señaló que ya toca mostrarlo (useHeaderTransform), TODO lo
  // que hay a la derecha del botón atrás (logo, nav, buscar, favoritos,
  // carrito, notificaciones, perfil) cede su lugar a las herramientas
  // propias de esa página, con un crossfade — el header nunca cambia de
  // tamaño ni posición, solo lo que hay adentro. Solo aplica en escritorio
  // (capa transformada `hidden md:flex`) — en móvil este mecanismo no
  // existe, la capa normal se queda siempre visible.
  const transformContent = useHeaderTransformStore((s) => s.content)
  const transformActive = useHeaderTransformStore((s) => s.active)
  const hideSearchTrigger = useHeaderTransformStore((s) => s.hideSearchTrigger)
  const transformed = transformActive && transformContent != null

  return (
    <>
      <div
        className={cn(
          'fixed inset-x-0 top-0 z-30 px-3 pt-3 transition-transform duration-300 md:sticky md:top-4 md:px-4 md:pt-0 md:!translate-y-0',
          hidden ? '-translate-y-[calc(100%+1rem)]' : 'translate-y-0',
        )}
      >
        <header className="mx-auto flex h-16 max-w-6xl items-center gap-3 rounded-full border border-border bg-background/90 px-3 shadow-sm backdrop-blur-md md:gap-5 md:px-4">
          <HeaderBackSlot />
          <div className="relative h-11 min-w-0 flex-1">
            {/* Capa normal: logo + nav + buscar/favoritos/carrito/
                notificaciones/perfil — sigue mostrándose completa en
                móvil (la transformación nunca aplica ahí), y en
                escritorio se desvanece cuando `transformed`. */}
            <div
              className={cn(
                'absolute inset-0 flex translate-y-0 items-center gap-3 opacity-100 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] md:gap-5',
                transformed && 'md:pointer-events-none md:-translate-y-2.5 md:opacity-0',
              )}
            >
              <Link to="/app" className="shrink-0 text-lg font-extrabold tracking-tight text-primary">
                MotoShots
              </Link>
              <nav className="hidden flex-1 items-center gap-1 text-sm font-medium lg:flex">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/app'}
                    className={({ isActive }) =>
                      cn(
                        'rounded-full px-3.5 py-2 transition-colors',
                        isActive ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground hover:text-foreground',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-2">
                <button
                  onClick={() => setSearchOpen(true)}
                  aria-label="Buscar en tus pedidos, eventos, fotógrafos y rutas"
                  title="Buscar"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-border"
                >
                  <IconSearch className="h-5 w-5" />
                </button>
                <Link
                  to="/app/favoritos"
                  aria-label="Favoritos"
                  title="Favoritos"
                  className="hidden h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-border sm:flex"
                >
                  <IconBookmark className="h-5 w-5" />
                </Link>
                <Link
                  id="header-cart-icon"
                  to="/app/checkout"
                  aria-label="Carrito"
                  title="Carrito"
                  className="relative hidden h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-border md:flex"
                >
                  <IconCart className="h-5 w-5" />
                  {itemCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                      {itemCount}
                    </span>
                  )}
                </Link>
                <NotificationsMenu />
                <div className="hidden md:block">
                  <ProfileMenu
                    name={profile?.display_name ?? 'Biker'}
                    email={user?.email}
                    avatar={
                      avatarUrl ? (
                        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <InitialsAvatar name={profile?.display_name ?? 'B'} className="h-full w-full bg-primary text-sm text-white" />
                      )
                    }
                    editProfile={
                      bikerDetails && (!bikerDetails.city || !bikerDetails.moto_brand)
                        ? { label: 'Completar perfil', to: '/app/perfil' }
                        : undefined
                    }
                    sections={[
                      [
                        { to: '/app/perfil', label: 'Mi perfil', icon: <IconUser className="h-4 w-4" /> },
                        { to: '/app/historial', label: 'Mis compras', icon: <IconCart className="h-4 w-4" /> },
                        { to: '/app/favoritos', label: 'Favoritos', icon: <IconBookmark className="h-4 w-4" /> },
                      ],
                      [
                        { to: '/changelog', label: 'Novedades', icon: <IconSparkles className="h-4 w-4" /> },
                        { onClick: handleSignOut, label: signingOut ? 'Saliendo…' : 'Cerrar sesión', icon: <IconLogOut className="h-4 w-4" />, tone: 'danger' },
                      ],
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Capa transformada: solo existe en el DOM a partir de md —
                en móvil `hidden` la saca del todo, sin importar
                `transformed`. La búsqueda global se queda disponible
                aquí también (a la derecha, con forma de cuadro de
                búsqueda), en el mismo lugar donde vivían buscar/
                favoritos/carrito/notificaciones/perfil — nunca en medio
                del contenido de la página. */}
            <div
              className={cn(
                'absolute inset-0 hidden items-center gap-2 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] md:flex',
                transformed ? 'delay-100 translate-y-0 opacity-100' : 'pointer-events-none translate-y-2.5 opacity-0',
              )}
            >
              <div className="min-w-0 flex-1">{transformContent}</div>
              {!hideSearchTrigger && (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="flex h-10 w-44 shrink-0 items-center gap-2 rounded-full bg-muted px-4 text-sm text-muted-foreground transition-colors hover:bg-border"
                >
                  <IconSearch className="h-5 w-5 shrink-0" />
                  <span className="truncate">Buscar…</span>
                </button>
              )}
            </div>
          </div>
        </header>
      </div>

      <BikerSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      <MobileBottomNav
        items={[
          { to: '/app', label: 'Inicio', icon: <IconHome className="h-full w-full" />, end: true },
          { to: '/app/eventos', label: 'Eventos', icon: <IconImages className="h-full w-full" /> },
          { to: '/app/checkout', label: 'Carrito', icon: <IconCart className="h-full w-full" /> },
          { to: '/app/perfil', label: 'Perfil', icon: <IconUser className="h-full w-full" /> },
        ]}
        primary={{ to: '/app/buscar', label: 'Buscar', icon: <IconSearch className="h-full w-full" /> }}
        activeClassName="text-primary"
      />
    </>
  )
}
