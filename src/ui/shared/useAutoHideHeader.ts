import { useEffect, useRef, useState } from 'react'
import { useScrollFocusStore } from './scrollFocusStore'

const HIDE_THRESHOLD = 12
const SHOW_THRESHOLD = 16
const MIN_SCROLL_TO_HIDE = 80
// Además de reaparecer al scrollear hacia arriba (ver más abajo), también
// reaparece incondicionalmente cerca del principio de la página — 100px ≈
// la altura típica de un título + su margen, sin ser tan bajo como para
// que reaparezca demasiado pronto.
const REAPPEAR_BELOW = 100

/** Verdadero mientras el usuario hace scroll hacia abajo (pasado un mínimo
 * desde arriba) — falso al scrollear hacia arriba (cualquier tramo, no
 * hace falta volver cerca del principio) o al volver a los primeros
 * `REAPPEAR_BELOW` px. Pensado para esconder el header en móvil ahora que
 * la navegación real vive en la barra inferior — en escritorio el
 * consumidor simplemente ignora este valor.
 *
 * Antes SOLO reaparecía cerca del principio (nunca con un scroll hacia
 * arriba a mitad de página) — un biker bajando por una lista larga de
 * fotos y subiendo un poco para revisar algo se quedaba sin header/menú
 * hasta volver al tope por completo, que se sentía roto. Ahora reaparece
 * con cualquier tramo de scroll hacia arriba que supere `SHOW_THRESHOLD`
 * (más alto que el de ocultar, para no parpadear si el scroll "tiembla"
 * unos px alrededor de cero entre eventos de scroll consecutivos). */
export function useAutoHideHeader() {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  const suppressed = useScrollFocusStore((s) => s.suppressed)

  useEffect(() => {
    lastY.current = window.scrollY
    function onScroll() {
      const y = window.scrollY
      const diff = y - lastY.current
      if (y <= REAPPEAR_BELOW) {
        setHidden(false)
      } else if (diff < -SHOW_THRESHOLD) {
        setHidden(false)
      } else if (y >= MIN_SCROLL_TO_HIDE && diff > HIDE_THRESHOLD) {
        setHidden(true)
      }
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Mientras un scroll programático está centrando una foto (ver
  // `scrollFocusStore`), nunca se oculta — ocultarse/mostrarse a mitad de
  // esa animación competía visualmente con ella y la foto terminaba
  // perdiendo el centrado.
  return suppressed ? false : hidden
}
