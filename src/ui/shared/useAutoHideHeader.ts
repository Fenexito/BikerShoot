import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 12
const MIN_SCROLL_TO_HIDE = 80

/** Verdadero mientras el usuario hace scroll hacia abajo (pasado un mínimo
 * desde arriba) — falso únicamente cuando vuelve al tope absoluto de la
 * página (scrollY === 0). Pensado para esconder el header en móvil ahora que
 * la navegación real vive en la barra inferior — en escritorio el
 * consumidor simplemente ignora este valor.
 *
 * A propósito NO reaparece con solo un pequeño scroll hacia arriba — antes
 * lo hacía (`diff < -THRESHOLD`), pero eso hacía que el header parpadeara
 * entrando/saliendo todo el tiempo mientras el usuario scrollea con calma.
 * Ahora solo dos gatillos: se oculta al bajar (igual que siempre), y
 * reaparece solo cuando el usuario realmente vuelve arriba del todo. */
export function useAutoHideHeader() {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    lastY.current = window.scrollY
    function onScroll() {
      const y = window.scrollY
      const diff = y - lastY.current
      if (y <= 0) {
        setHidden(false)
      } else if (y >= MIN_SCROLL_TO_HIDE && diff > THRESHOLD) {
        setHidden(true)
      }
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return hidden
}
