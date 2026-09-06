import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 12
const MIN_SCROLL_TO_HIDE = 80

/** Verdadero mientras el usuario hace scroll hacia abajo (pasado un mínimo
 * desde arriba) — falso cuando sube o está cerca del tope. Pensado para
 * esconder el header en móvil ahora que la navegación real vive en la barra
 * inferior — en escritorio el consumidor simplemente ignora este valor. */
export function useAutoHideHeader() {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    lastY.current = window.scrollY
    function onScroll() {
      const y = window.scrollY
      const diff = y - lastY.current
      if (y < MIN_SCROLL_TO_HIDE) {
        setHidden(false)
      } else if (diff > THRESHOLD) {
        setHidden(true)
      } else if (diff < -THRESHOLD) {
        setHidden(false)
      }
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return hidden
}
