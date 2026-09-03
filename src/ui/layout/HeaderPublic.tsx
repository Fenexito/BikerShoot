import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../flat/Button'
import { IconMenu, IconClose } from '../shared/icons'
import { MobileMenuOverlay } from '../shared/MobileMenuOverlay'

const NAV_ITEMS = [
  { to: '/eventos', label: 'Eventos' },
  { to: '/fotografos', label: 'Fotógrafos' },
  { to: '/precios', label: 'Precios' },
]

export function HeaderPublic() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="sticky top-3 z-30 px-3 md:top-4 md:px-4">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between rounded-full border border-border bg-muted/80 px-3 shadow-sm backdrop-blur-md md:px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setMenuOpen(true)} aria-label="Abrir menú" className="text-foreground md:hidden">
            <IconMenu className="h-6 w-6" />
          </button>
          <Link to="/" className="pl-2 text-lg font-extrabold tracking-tight text-primary">
            MotoShots
          </Link>
        </div>
        <nav className="hidden gap-7 text-sm font-medium text-foreground md:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.to} to={item.to} className="transition-colors hover:text-primary">
              {item.label}
            </Link>
          ))}
          <Link to="/studio/login" className="text-muted-foreground transition-colors hover:text-foreground">
            Soy fotógrafo
          </Link>
        </nav>
        <div className="flex gap-2">
          <Link to="/login">
            <Button variant="outline" size="sm">
              Iniciar sesión
            </Button>
          </Link>
          <Link to="/signup" className="hidden sm:block">
            <Button size="sm">Crear cuenta</Button>
          </Link>
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
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className="border-b border-border py-4 text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/studio/login"
            onClick={() => setMenuOpen(false)}
            className="border-b border-border py-4 text-muted-foreground"
          >
            Soy fotógrafo
          </Link>
        </nav>
        <div className="flex flex-col gap-2 px-4 py-4 sm:hidden">
          <Link to="/signup" onClick={() => setMenuOpen(false)}>
            <Button className="w-full justify-center">Crear cuenta</Button>
          </Link>
        </div>
      </MobileMenuOverlay>
    </div>
  )
}
