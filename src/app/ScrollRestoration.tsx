import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const positions = new Map<string, number>()

/** Al navegar a una página nueva (click en link/botón) siempre inicia arriba.
 * Al usar atrás/adelante del navegador, restaura la posición donde el usuario
 * se había quedado. React Router no hace esto por defecto en un SPA. */
export function ScrollRestoration() {
  const location = useLocation()
  const navType = useNavigationType()
  const lastKey = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      positions.set(location.key, window.scrollY)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  useLayoutEffect(() => {
    if (lastKey.current === location.key) return
    lastKey.current = location.key

    if (navType === 'POP') {
      const saved = positions.get(location.key)
      window.scrollTo(0, saved ?? 0)
    } else {
      window.scrollTo(0, 0)
    }
  }, [location.key, navType])

  return null
}
