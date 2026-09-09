import { useEffect } from 'react'

let lockCount = 0
let savedScrollY = 0

/** Bloquea el scroll de `<body>` mientras `active` es `true` — pensado para
 * modales a pantalla completa (filtros, búsqueda global, etc).
 *
 * Antes varios modales solo hacían `document.body.style.overflow = 'hidden'`.
 * Eso no alcanza en todos los navegadores/dispositivos: con `overflow:hidden`
 * el body deja de tener su propia barra de scroll, pero el contenido detrás
 * del modal (position `fixed`/`sticky`, o el "rubber-band"/overscroll de iOS)
 * puede seguir moviéndose con la rueda o el dedo, y el usuario ve la página
 * de fondo desplazarse detrás del overlay oscuro. La técnica robusta es fijar
 * el body en su lugar (`position: fixed`, con un `top` negativo igual al
 * scroll actual) para que no haya NADA que desplazar hasta soltar el lock,
 * momento en el que se restaura la posición exacta de scroll de antes.
 *
 * Cuenta cuántos consumidores piden el lock a la vez (`lockCount`) para que
 * dos modales abiertos en simultáneo (poco común, pero posible durante una
 * transición) no se pisen el uno al otro al cerrarse. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return

    if (lockCount === 0) {
      savedScrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${savedScrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
    }
    lockCount += 1

    return () => {
      lockCount -= 1
      if (lockCount === 0) {
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.left = ''
        document.body.style.right = ''
        window.scrollTo(0, savedScrollY)
      }
    }
  }, [active])
}
