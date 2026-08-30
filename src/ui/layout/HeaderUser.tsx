import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { useCartStore } from '../../features/cart/cartStore'
import { IconHeart, IconCart, IconUser, IconLogOut, IconMenu, IconClose } from '../shared/icons'
import { MobileMenuOverlay } from '../shared/MobileMenuOverlay'

const NAV_ITEMS = [
  { to: '/app/buscar', label: 'Buscar fotos' },
  { to: '/app/mapa', label: 'Mapa' },
  { to: '/app/eventos', label: 'Eventos' },
  { to: '/app/fotografos', label: 'Fotógrafos' },
  { to: '/app/historial', label: 'Mis compras' },
]

export function HeaderUser() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const itemCount = useCartStore((s) => s.items.length)
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
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setMenuOpen(true)} aria-label="Abrir menú" className="text-foreground md:hidden">
            <IconMenu className="h-6 w-6" />
          </button>
          <Link to="/app" className="text-lg font-extrabold tracking-tight text-primary">
            MotoShots
          </Link>
        </div>
        <nav className="hidden gap-6 text-sm font-medium text-foreground md:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.to} to={item.to}>{item.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/app/favoritos" aria-label="Favoritos" title="Favoritos" className="text-foreground hover:text-primary">
            <IconHeart className="h-5 w-5" />
          </Link>
          <Link to="/app/checkout" aria-label="Carrito" title="Carrito" className="relative text-foreground hover:text-primary">
            <IconCart className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </Link>
          <Link to="/app/perfil" aria-label="Perfil" title="Perfil" className="hidden text-foreground hover:text-primary sm:inline-block">
            <IconUser className="h-5 w-5" />
          </Link>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Salir"
            title="Salir"
            className="hidden text-muted-foreground hover:text-foreground disabled:opacity-50 sm:inline-block"
          >
            <IconLogOut className="h-5 w-5" />
          </button>
        </div>
      </div>

      <MobileMenuOverlay open={menuOpen} onClose={() => setMenuOpen(false)} className="rounded-b-2xl border-b border-border bg-background">
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <span className="text-lg font-extrabold tracking-tight text-primary">MotoShots</span>
          <button onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" className="text-foreground">
            <IconClose className="h-6 w-6" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 px-4 py-4 text-base font-medium">
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
    </header>
  )
}
