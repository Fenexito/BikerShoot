import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { cn } from '../../lib/cn'

const LINKS = [
  { to: '/admin', label: 'Resumen' },
  { to: '/admin/aprobar-fotografos', label: 'Fotógrafos' },
  { to: '/admin/bug-reports', label: 'Bugs' },
  { to: '/admin/releases', label: 'Releases' },
  { to: '/admin/planes', label: 'Planes' },
]

export function HeaderAdmin() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
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
    <header className="border-b border-border bg-background font-flat">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/admin" className="text-lg font-extrabold tracking-tight text-primary">
          MotoShots Admin
        </Link>
        <nav className="hidden gap-6 text-sm font-medium text-foreground md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(location.pathname === l.to ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {signingOut ? 'Saliendo…' : 'Salir'}
        </button>
      </div>
    </header>
  )
}
