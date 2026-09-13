import { Link, useNavigate } from 'react-router-dom'
import { useBackButtonStore } from './backButtonStore'
import { AnimateIcon } from '../animate-icons/icon'
import { ChevronLeft } from '../animate-icons/icons/ChevronLeft'

/** Hueco de ancho fijo al borde del header, reservado siempre (con o sin
 * flecha) — así el resto del header (logo, nav) no se desplaza entre una
 * página que necesita "volver" y una que no. Sin círculo/fondo alrededor,
 * solo el ícono, tal como se pidió.
 *
 * `AnimateIcon animateOnHover animateOnTap asChild` envuelve el `<button>`/`<Link>`
 * completo (no el ícono suelto) — el hover que dispara la animación es el
 * de toda el área clicable, no solo el trazo chico de la flecha. */
export function HeaderBackSlot() {
  const target = useBackButtonStore((s) => s.target)
  const navigate = useNavigate()

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center">
      {target === 'back' ? (
        <AnimateIcon animateOnHover animateOnTap asChild>
          <button
            onClick={() => navigate(-1)}
            aria-label="Volver"
            className="flex h-full w-full items-center justify-center text-foreground transition-colors hover:text-muted-foreground"
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>
        </AnimateIcon>
      ) : target ? (
        <AnimateIcon animateOnHover animateOnTap asChild>
          <Link
            to={target}
            aria-label="Volver"
            className="flex h-full w-full items-center justify-center text-foreground transition-colors hover:text-muted-foreground"
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </Link>
        </AnimateIcon>
      ) : null}
    </div>
  )
}
