import { Link, useNavigate } from 'react-router-dom'
import { useBackButtonStore } from './backButtonStore'
import { IconChevronLeft } from './icons'

/** Hueco de ancho fijo al borde del header, reservado siempre (con o sin
 * flecha) — así el resto del header (logo, nav) no se desplaza entre una
 * página que necesita "volver" y una que no. Sin círculo/fondo alrededor,
 * solo el ícono, tal como se pidió. */
export function HeaderBackSlot() {
  const target = useBackButtonStore((s) => s.target)
  const navigate = useNavigate()

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center">
      {target === 'back' ? (
        <button
          onClick={() => navigate(-1)}
          aria-label="Volver"
          className="flex h-full w-full items-center justify-center text-foreground transition-colors hover:text-muted-foreground"
        >
          <IconChevronLeft className="h-5 w-5" strokeWidth={2.5} />
        </button>
      ) : target ? (
        <Link
          to={target}
          aria-label="Volver"
          className="flex h-full w-full items-center justify-center text-foreground transition-colors hover:text-muted-foreground"
        >
          <IconChevronLeft className="h-5 w-5" strokeWidth={2.5} />
        </Link>
      ) : null}
    </div>
  )
}
