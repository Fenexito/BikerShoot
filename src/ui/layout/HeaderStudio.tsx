import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ThemeToggle } from '../studio/ThemeToggle'
import { useAuth } from '../../features/auth/AuthContext'
import { IconUser, IconLogOut, IconMenu, IconClose } from '../shared/icons'
import { MobileMenuOverlay } from '../shared/MobileMenuOverlay'
import { cn } from '../../lib/cn'

const NAV_LINK =
  'group relative inline-flex items-center py-1 text-muted-foreground transition-colors duration-150 hover:text-foreground'
const NAV_UNDERLINE =
  'absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-foreground transition-transform duration-150 group-hover:scale-x-100'

const NAV_ITEMS = [
  { to: '/studio/eventos', label: 'Eventos' },
  { to: '/studio/pedidos', label: 'Pedidos' },
  { to: '/studio/almacenamiento', label: 'Almacenamiento' },
  { to: '/studio/planes', label: 'Planes' },
]

export function HeaderStudio() {
  const { signOut } = useAuth()
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
    <header className="sticky top-0 z-30 border-b border-border bg-background text-foreground">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-6 md:px-16">
        <Link to="/studio" className="font-studio text-lg font-bold tracking-tight2">
          MotoShots Studio
        </Link>
        <nav className="hidden gap-6 font-studio-mono text-xs uppercase tracking-wider2 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.to} to={item.to} className={NAV_LINK}>
              {item.label}
              <span className={NAV_UNDERLINE} />
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-5 md:flex">
          <ThemeToggle />
          <Link to="/studio/perfil" aria-label="Perfil" title="Perfil" className="text-muted-foreground hover:text-foreground">
            <IconUser className="h-5 w-5" />
          </Link>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Salir"
            title="Salir"
            className={cn('text-muted-foreground hover:text-foreground', signingOut && 'opacity-50')}
          >
            <IconLogOut className="h-5 w-5" />
          </button>
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú"
          className="text-foreground md:hidden"
        >
          <IconMenu className="h-6 w-6" />
        </button>
      </div>

      <MobileMenuOverlay open={menuOpen} onClose={() => setMenuOpen(false)} className="border-b border-border bg-background">
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <span className="font-studio text-lg font-bold tracking-tight2">MotoShots Studio</span>
          <button onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" className="text-foreground">
            <IconClose className="h-6 w-6" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 px-6 py-6 font-studio-mono text-sm uppercase tracking-wider2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className="border-b border-border py-4 text-foreground"
            >
              {item.label}
            </Link>
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
            className={cn('flex items-center gap-2 font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground', signingOut && 'opacity-50')}
          >
            <IconLogOut className="h-4 w-4" />
            Salir
          </button>
        </div>
      </MobileMenuOverlay>
    </header>
  )
}
