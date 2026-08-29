import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { useCartStore } from '../../features/cart/cartStore'

export function HeaderUser() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const itemCount = useCartStore((s) => s.items.length)
  const [signingOut, setSigningOut] = useState(false)

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
        <Link to="/app" className="text-lg font-extrabold tracking-tight text-primary">
          MotoShots
        </Link>
        <nav className="hidden gap-6 text-sm font-medium text-foreground md:flex">
          <Link to="/app/buscar">Buscar fotos</Link>
          <Link to="/app/mapa">Mapa</Link>
          <Link to="/app/eventos">Eventos</Link>
          <Link to="/app/fotografos">Fotógrafos</Link>
          <Link to="/app/historial">Mis compras</Link>
        </nav>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/app/favoritos" aria-label="Favoritos" className="text-foreground">
            ♡
          </Link>
          <Link to="/app/checkout" aria-label="Carrito" className="relative text-foreground">
            🛒
            {itemCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </Link>
          <Link to="/app/perfil" aria-label="Perfil" className="text-foreground">
            👤
          </Link>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {signingOut ? 'Saliendo…' : 'Salir'}
          </button>
        </div>
      </div>
    </header>
  )
}
