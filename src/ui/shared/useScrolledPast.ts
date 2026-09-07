import { useEffect, useState } from 'react'

/** Verdadero mientras `window.scrollY` supera `threshold`. Usado por los
 * headers que se transforman (ver `useHeaderTransform`) para decidir cuándo
 * cruzar del nav por defecto al contenido registrado por la página. */
export function useScrolledPast(threshold: number) {
  const [past, setPast] = useState(false)

  useEffect(() => {
    function onScroll() {
      setPast(window.scrollY > threshold)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return past
}
