import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const positions = new Map<string, number>()

/** Al navegar a una página nueva (click en link/botón) siempre inicia arriba.
 * Al usar atrás/adelante del navegador, restaura la posición donde el usuario
 * se había quedado. React Router no hace esto por defecto en un SPA.
 *
 * A propósito NO fuerza scroll-to-top cuando solo cambian los QUERY PARAMS
 * de la MISMA ruta (`pathname` igual) — `setSearchParams(..., {replace:
 * true})` genera un `location.key` nuevo igual que una navegación real, así
 * que antes cualquier cambio de filtro (Eventos, Pedidos, etc., todos
 * guardan su estado de filtro en la URL) disparaba un scroll-to-top no
 * pedido, sacando al usuario de donde estaba viendo la lista justo cuando
 * tocaba un filtro. Solo un cambio de PATHNAME cuenta como "navegó a una
 * página nueva". */
export function ScrollRestoration() {
  const location = useLocation()
  const navType = useNavigationType()
  const lastKey = useRef<string | null>(null)
  const lastPathname = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      positions.set(location.key, window.scrollY)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  useLayoutEffect(() => {
    if (lastKey.current === location.key) return
    lastKey.current = location.key

    const pathnameChanged = lastPathname.current !== location.pathname
    lastPathname.current = location.pathname

    if (navType === 'POP') {
      const saved = positions.get(location.key)
      window.scrollTo(0, saved ?? 0)
    } else if (pathnameChanged) {
      window.scrollTo(0, 0)
    }
    // Mismo pathname, solo cambiaron los query params (ej. un filtro) — no
    // tocar el scroll, el usuario se queda justo donde estaba.
  }, [location.key, navType, location.pathname])

  return null
}
