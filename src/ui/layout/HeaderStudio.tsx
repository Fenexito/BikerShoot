import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ThemeToggle } from '../studio/ThemeToggle'
import { useAuth } from '../../features/auth/AuthContext'
import { IconUser, IconLogOut } from '../shared/icons'
import { cn } from '../../lib/cn'

const NAV_LINK =
  'group relative inline-flex items-center py-1 text-muted-foreground transition-colors duration-150 hover:text-foreground'
const NAV_UNDERLINE =
  'absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-foreground transition-transform duration-150 group-hover:scale-x-100'

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
    <header className="sticky top-0 z-30 border-b border-border bg-background text-foreground">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-6 md:px-16">
        <Link to="/studio" className="font-studio text-lg font-bold tracking-tight2">
          MotoShots Studio
        </Link>
        <nav className="hidden gap-6 font-studio-mono text-xs uppercase tracking-wider2 md:flex">
          <Link to="/studio/eventos" className={NAV_LINK}>
            Eventos
            <span className={NAV_UNDERLINE} />
          </Link>
          <Link to="/studio/pedidos" className={NAV_LINK}>
            Pedidos
            <span className={NAV_UNDERLINE} />
          </Link>
          <Link to="/studio/estadisticas" className={NAV_LINK}>
            Estadísticas
            <span className={NAV_UNDERLINE} />
          </Link>
          <Link to="/studio/almacenamiento" className={NAV_LINK}>
            Almacenamiento
            <span className={NAV_UNDERLINE} />
          </Link>
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
            className={cn('text-muted-foreground hover:text-foreground', signingOut && 'opacity-50')}
          >
            <IconLogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
