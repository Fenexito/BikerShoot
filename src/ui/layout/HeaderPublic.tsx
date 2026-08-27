import { Link } from 'react-router-dom'
import { Button } from '../flat/Button'

export function HeaderPublic() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="text-lg font-extrabold tracking-tight text-primary">
          MotoShots
        </Link>
        <nav className="hidden gap-6 text-sm font-medium text-foreground md:flex">
          <Link to="/eventos">Eventos</Link>
          <Link to="/fotografos">Fotógrafos</Link>
          <Link to="/precios">Precios</Link>
          <Link to="/studio/login" className="text-muted-foreground">
            Soy fotógrafo
          </Link>
        </nav>
        <div className="flex gap-2">
          <Link to="/login">
            <Button variant="secondary" size="sm">
              Iniciar sesión
            </Button>
          </Link>
          <Link to="/signup">
            <Button size="sm">Crear cuenta</Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
