import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { ThemeToggle } from '../studio/ThemeToggle'
import { useAuth } from '../../features/auth/AuthContext'
import { r2Url } from '../../lib/r2'
import { IconUser, IconLogOut, IconMenu, IconClose } from '../shared/icons'
import { MobileMenuOverlay } from '../shared/MobileMenuOverlay'
import { InitialsAvatar } from '../shared/InitialsAvatar'
import { ProfileMenu } from '../shared/ProfileMenu'
import { NotificationsMenu } from '../shared/NotificationsMenu'
import { cn } from '../../lib/cn'

const NAV_ITEMS = [
  { to: '/studio/eventos', label: 'Eventos' },
  { to: '/studio/pedidos', label: 'Pedidos' },
  { to: '/studio/almacenamiento', label: 'Almacenamiento' },
  { to: '/studio/planes', label: 'Planes' },
]

export function HeaderStudio() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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

  return (
    <div className="sticky top-3 z-30 px-3 md:top-4 md:px-6">
      <header className="mx-auto flex h-16 max-w-screen-xl items-center gap-4 rounded-full border border-border bg-background/90 px-4 shadow-sm backdrop-blur-md md:px-6">
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
                  isActive ? 'bg-accent/10 font-semibold text-accent' : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-muted md:flex">
            <ThemeToggle />
          </div>
          <div className="hidden md:block">
            <NotificationsMenu />
          </div>
          <ProfileMenu
            name={profile?.display_name ?? 'Estudio'}
            avatar={
              avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <InitialsAvatar name={profile?.display_name ?? 'S'} className="h-full w-full bg-accent text-sm text-accent-foreground" />
              )
            }
            links={[
              { to: '/studio/perfil', label: 'Mi perfil', icon: <IconUser className="h-4 w-4" /> },
              { to: '/studio/almacenamiento', label: 'Almacenamiento' },
              { to: '/studio/planes', label: 'Planes y facturación' },
              { onClick: handleSignOut, label: signingOut ? 'Saliendo…' : 'Cerrar sesión', icon: <IconLogOut className="h-4 w-4" />, tone: 'danger' },
            ]}
          />
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
            className="text-foreground md:hidden"
          >
            <IconMenu className="h-6 w-6" />
          </button>
        </div>
      </header>

      <MobileMenuOverlay open={menuOpen} onClose={() => setMenuOpen(false)} className="rounded-b-3xl border-b border-border bg-background">
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <span className="font-studio text-lg font-bold tracking-tight2">MotoShots Studio</span>
          <button onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" className="text-foreground">
            <IconClose className="h-6 w-6" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 px-6 py-6 text-sm font-medium">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => cn('border-b border-border py-4', isActive ? 'font-semibold text-accent' : 'text-foreground')}
            >
              {item.label}
            </NavLink>
          ))}
          <Link to="/studio/perfil" onClick={() => setMenuOpen(false)} className="border-b border-border py-4 text-foreground">
            Perfil
          </Link>
        </nav>
        <div className="mt-auto flex items-center justify-between border-t border-border px-6 py-5">
          <ThemeToggle />
          <button
            onClick={() => {
              setMenuOpen(false)
              handleSignOut()
            }}
            disabled={signingOut}
            className={cn('flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground', signingOut && 'opacity-50')}
          >
            <IconLogOut className="h-4 w-4" />
            Salir
          </button>
        </div>
      </MobileMenuOverlay>
    </div>
  )
}
