import { useEffect, useState } from 'react'

/** Verdadero mientras `window.scrollY` supera `threshold`. Usado por los
 * headers que se transforman (ver `useHeaderTransform`) para decidir cuándo
 * cruzar del nav por defecto al contenido registrado por la página.
 *
 * `exitThreshold` (por defecto, el mismo `threshold`) agrega histéresis: una
 * vez `past` se vuelve `true` hace falta bajar hasta `threshold` para
 * activarse, pero para desactivarse hace falta subir hasta `exitThreshold`
 * (menor que `threshold`). Sin esto, una página cuyo layout se encoge al
 * cruzar el umbral (ej. un hero que colapsa) puede empujar el scroll de
 * vuelta justo por debajo del umbral en el mismo instante en que se activa,
 * lo que dispara un ciclo activa/desactiva sin fin — el header queda
 * "atascado" haciendo la animación de entrada/salida sin parar hasta que el
 * usuario vuelve a mover la rueda del mouse. */
export function useScrolledPast(threshold: number, exitThreshold: number = threshold) {
  const [past, setPast] = useState(false)

  useEffect(() => {
    function onScroll() {
      setPast((prev) => (prev ? window.scrollY > exitThreshold : window.scrollY > threshold))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold, exitThreshold])

  return past
}
