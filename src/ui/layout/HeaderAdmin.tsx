import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { AnimateIcon } from '../animate-icons/icon'
import { Menu } from '../animate-icons/icons/Menu'
import { X } from '../animate-icons/icons/X'
import { LogOut } from '../animate-icons/icons/LogOut'
import { MobileMenuOverlay } from '../shared/MobileMenuOverlay'
import { InitialsAvatar } from '../shared/InitialsAvatar'
import { ProfileMenu } from '../shared/ProfileMenu'
import { cn } from '../../lib/cn'

const NAV_ITEMS = [
  { to: '/admin', label: 'Resumen' },
  { to: '/admin/aprobar-fotografos', label: 'Fotógrafos' },
  { to: '/admin/bug-reports', label: 'Bugs' },
  { to: '/admin/releases', label: 'Releases' },
  { to: '/admin/planes', label: 'Planes' },
]

export function HeaderAdmin() {
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

  return (
    <div className="sticky top-3 z-30 px-3 font-flat md:top-4 md:px-4">
      <header className="mx-auto flex h-16 max-w-6xl items-center gap-4 rounded-full border border-border bg-background/90 px-4 shadow-sm backdrop-blur-md">
        <AnimateIcon animateOnHover animateOnTap asChild>
          <button onClick={() => setMenuOpen(true)} aria-label="Abrir menú" className="text-foreground md:hidden">
            <Menu size={24} />
          </button>
        </AnimateIcon>
        <Link to="/admin" className="shrink-0 text-lg font-extrabold tracking-tight text-primary">
          MotoShots Admin
        </Link>
        <nav className="ml-2 hidden flex-1 items-center gap-1 text-sm font-medium md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
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
        <div className="ml-auto shrink-0">
          <ProfileMenu
            name={profile?.display_name ?? 'Admin'}
            avatar={<InitialsAvatar name={profile?.display_name ?? 'A'} className="h-full w-full bg-foreground text-sm text-background" />}
            sections={[
              [{ onClick: handleSignOut, label: signingOut ? 'Saliendo…' : 'Cerrar sesión', icon: <LogOut size={16} />, tone: 'danger' }],
            ]}
          />
        </div>
      </header>

      <MobileMenuOverlay open={menuOpen} onClose={() => setMenuOpen(false)} className="rounded-b-3xl border-b border-border bg-background">
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <span className="text-lg font-extrabold tracking-tight text-primary">MotoShots Admin</span>
          <AnimateIcon animateOnHover animateOnTap asChild>
            <button onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" className="text-foreground">
              <X size={24} />
            </button>
          </AnimateIcon>
        </div>
        <nav className="flex flex-col gap-1 px-4 py-4 text-base font-medium">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => cn('flex items-center gap-2 border-b border-border py-4', isActive ? 'font-semibold text-primary' : 'text-foreground')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4">
          <AnimateIcon animateOnHover animateOnTap asChild>
            <button
              onClick={() => {
                setMenuOpen(false)
                handleSignOut()
              }}
              disabled={signingOut}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground disabled:opacity-50"
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </AnimateIcon>
        </div>
      </MobileMenuOverlay>
    </div>
  )
}
