import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ThemeToggle } from '../studio/ThemeToggle'
import { useAuth } from '../../features/auth/AuthContext'
import { IconUser, IconLogOut } from '../shared/icons'

export function HeaderStudio() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
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
    <header className="border-b border-border bg-background text-foreground">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/studio" className="font-studio text-lg font-bold tracking-tight2">
          MotoShots Studio
        </Link>
        <nav className="hidden gap-6 font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground md:flex">
          <Link to="/studio/eventos">Eventos</Link>
          <Link to="/studio/pedidos">Pedidos</Link>
          <Link to="/studio/estadisticas">Estadísticas</Link>
          <Link to="/studio/carga-rapida">Carga rápida</Link>
        </nav>
        <div className="flex items-center gap-5">
          <ThemeToggle />
          <Link to="/studio/perfil" aria-label="Perfil" title="Perfil" className="text-muted-foreground hover:text-foreground">
            <IconUser className="h-5 w-5" />
          </Link>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Salir"
            title="Salir"
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <IconLogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
