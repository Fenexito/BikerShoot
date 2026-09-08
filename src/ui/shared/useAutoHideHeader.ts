import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 12
const MIN_SCROLL_TO_HIDE = 80
// Antes reaparecía solo en `y === 0` (tope absoluto) — el usuario lo sintió
// demasiado tarde en páginas con un título/hero alto (ej. el evento):
// pedía volver a verlo apenas se pasa el título, no hasta el borde
// literal de la página. 100px ≈ la altura típica de un título + su
// margen, sin ser tan bajo como para que reaparezca demasiado pronto.
const REAPPEAR_BELOW = 100

/** Verdadero mientras el usuario hace scroll hacia abajo (pasado un mínimo
 * desde arriba) — falso al volver a los primeros `REAPPEAR_BELOW` px de la
 * página (no hace falta llegar al tope absoluto). Pensado para esconder el
 * header en móvil ahora que la navegación real vive en la barra inferior —
 * en escritorio el consumidor simplemente ignora este valor.
 *
 * A propósito NO reaparece con solo un pequeño scroll hacia arriba — antes
 * lo hacía (`diff < -THRESHOLD`), pero eso hacía que el header parpadeara
 * entrando/saliendo todo el tiempo mientras el usuario scrollea con calma.
 * Ahora solo dos gatillos: se oculta al bajar (igual que siempre), y
 * reaparece solo cuando el usuario vuelve cerca del principio. */
export function useAutoHideHeader() {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    lastY.current = window.scrollY
    function onScroll() {
      const y = window.scrollY
      const diff = y - lastY.current
      if (y <= REAPPEAR_BELOW) {
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
