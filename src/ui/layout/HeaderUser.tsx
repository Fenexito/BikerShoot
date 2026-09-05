import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { useBikerDetails } from '../../features/biker/useBikerDetails'
import { useCartStore } from '../../features/cart/cartStore'
import { r2Url } from '../../lib/r2'
import { IconHeart, IconCart, IconUser, IconLogOut, IconMenu, IconClose, IconSearch, IconSparkles } from '../shared/icons'
import { MobileMenuOverlay } from '../shared/MobileMenuOverlay'
import { InitialsAvatar } from '../shared/InitialsAvatar'
import { ProfileMenu } from '../shared/ProfileMenu'
import { NotificationsMenu } from '../shared/NotificationsMenu'
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      navigate('/')
    } finally {
      setSigningOut(false)
    }
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    navigate(query.trim() ? `/app/buscar?q=${encodeURIComponent(query.trim())}` : '/app/buscar')
  }

  const avatarUrl = profile?.avatar_url ? (profile.avatar_url.startsWith('http') ? profile.avatar_url : r2Url(profile.avatar_url)) : null

  return (
    <div className="sticky top-3 z-30 px-3 md:top-4 md:px-4">
      <header className="mx-auto flex h-16 max-w-6xl items-center gap-3 rounded-full border border-border bg-background/90 px-3 shadow-sm backdrop-blur-md md:gap-5 md:px-4">
        <button onClick={() => setMenuOpen(true)} aria-label="Abrir menú" className="text-foreground md:hidden">
          <IconMenu className="h-6 w-6" />
        </button>
        <Link to="/app" className="shrink-0 text-lg font-extrabold tracking-tight text-primary">
          MotoShots
        </Link>

        <nav className="hidden shrink-0 items-center gap-1 text-sm font-medium lg:flex">
          {NAV_ITEMS.slice(0, 4).map((item) => (
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

        <form onSubmit={submitSearch} className="ml-auto hidden max-w-md flex-1 items-center gap-2 rounded-full bg-muted px-4 md:flex">
          <IconSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar evento, fotógrafo, ciudad…"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0 md:gap-2">
          <Link
            to="/app/favoritos"
            aria-label="Favoritos"
            title="Favoritos"
            className="hidden h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-border sm:flex"
          >
            <IconHeart className="h-5 w-5" />
          </Link>
          <Link
            to="/app/checkout"
            aria-label="Carrito"
            title="Carrito"
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-border"
          >
            <IconCart className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </Link>
          <NotificationsMenu />
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
                { to: '/app/favoritos', label: 'Favoritos', icon: <IconHeart className="h-4 w-4" /> },
              ],
              [
                { to: '/changelog', label: 'Novedades', icon: <IconSparkles className="h-4 w-4" /> },
                { onClick: handleSignOut, label: signingOut ? 'Saliendo…' : 'Cerrar sesión', icon: <IconLogOut className="h-4 w-4" />, tone: 'danger' },
              ],
            ]}
          />
        </div>
      </header>

      <MobileMenuOverlay open={menuOpen} onClose={() => setMenuOpen(false)} className="rounded-b-3xl border-b border-border bg-background">
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <span className="text-lg font-extrabold tracking-tight text-primary">MotoShots</span>
          <button onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" className="text-foreground">
            <IconClose className="h-6 w-6" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 px-4 py-4 text-base font-medium">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => cn('border-b border-border py-4', isActive ? 'font-semibold text-primary' : 'text-foreground')}
            >
              {item.label}
            </NavLink>
          ))}
          <Link to="/app/perfil" onClick={() => setMenuOpen(false)} className="border-b border-border py-4 text-foreground">
            Mi perfil
          </Link>
        </nav>
        <div className="px-4 py-4">
          <button
            onClick={() => {
              setMenuOpen(false)
              handleSignOut()
            }}
            disabled={signingOut}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground disabled:opacity-50"
          >
            <IconLogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </MobileMenuOverlay>
    </div>
  )
}
