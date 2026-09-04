import { Link } from 'react-router-dom'

const LINKS = [
  { to: '/eventos', label: 'Eventos' },
  { to: '/fotografos', label: 'Fotógrafos' },
  { to: '/precios', label: 'Precios' },
  { to: '/changelog', label: 'Novedades' },
]

const LEGAL_LINKS = [
  { to: '/privacidad', label: 'Privacidad' },
  { to: '/terminos', label: 'Términos' },
  { to: '/derechos-de-autor', label: 'Derechos de autor' },
]

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-muted/40 px-6 py-12 text-sm text-muted-foreground md:px-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-lg font-extrabold tracking-tight text-primary">MotoShots</p>
          <p className="mt-1 max-w-xs">Fotos de rodadas, pistas y encuentros en Guatemala.</p>
        </div>
        <div className="flex flex-col gap-2">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="transition-colors hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="transition-colors hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-6xl border-t border-border pt-6">
        © {new Date().getFullYear()} MotoShots. Todos los derechos reservados.
      </div>
    </footer>
  )
}
