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

const NAV_ITEMS = [
  { to: '/app/buscar', label: 'Buscar fotos' },
  { to: '/app/mapa', label: 'Mapa' },
  { to: '/app/eventos', label: 'Eventos' },
  { to: '/app/fotografos', label: 'Fotógrafos' },
  { to: '/app/historial', label: 'Mis compras' },
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

  // Igual que en HeaderStudio: si la página actual registró contenido y
  // señaló que ya toca mostrarlo (ver useHeaderTransform), el nav +
  // buscador genérico ceden su lugar a las herramientas propias de esa
  // página — Search.tsx, Events.tsx, PhotographersList.tsx y RouteMap.tsx
  // ya lo usan.
  const transformContent = useHeaderTransformStore((s) => s.content)
  const transformActive = useHeaderTransformStore((s) => s.active)
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
          <Link to="/app" className="shrink-0 text-lg font-extrabold tracking-tight text-primary">
            MotoShots
          </Link>

          <div className="relative hidden h-11 flex-1 items-center md:flex">
            <div
              className={cn(
                // Igual que en HeaderStudio: este bloque completo (nav +
                // buscador) ya vive dentro de un contenedor `hidden md:flex`
                // (línea de arriba), así que en la práctica este
                // desvanecimiento solo puede aplicar desde md: — pero se
                // deja el mismo prefijo `md:` explícito que en HeaderStudio
                // por si el contenedor padre alguna vez deja de ocultarlo
                // en móvil, para no reintroducir el bug del header vacío.
                'flex w-full translate-y-0 items-center opacity-100 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                transformed && 'md:pointer-events-none md:-translate-y-2.5 md:opacity-0',
              )}
            >
              <nav className="hidden shrink-0 items-center gap-1 text-sm font-medium lg:flex">
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
            </div>
            <div
              className={cn(
                'absolute inset-0 flex items-center transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                transformed ? 'delay-100 translate-y-0 opacity-100' : 'pointer-events-none translate-y-2.5 opacity-0',
              )}
            >
              {transformContent}
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0 md:gap-2">
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
