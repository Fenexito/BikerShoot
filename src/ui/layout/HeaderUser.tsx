import { Link } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'

export function HeaderUser() {
  const { signOut } = useAuth()

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/app" className="text-lg font-extrabold tracking-tight text-primary">
          MotoShots
        </Link>
        <nav className="hidden gap-6 text-sm font-medium text-foreground md:flex">
          <Link to="/app/buscar">Buscar fotos</Link>
          <Link to="/app/fotografos">Fotógrafos</Link>
          <Link to="/app/historial">Mis compras</Link>
        </nav>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/app/checkout" aria-label="Carrito" className="text-foreground">
            🛒
          </Link>
          <Link to="/app/perfil" aria-label="Perfil" className="text-foreground">
            👤
          </Link>
          <button onClick={() => signOut()} className="text-muted-foreground hover:text-foreground">
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}
