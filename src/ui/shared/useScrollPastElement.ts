import { useEffect, useState, type RefObject } from 'react'

/** Verdadero una vez el elemento referenciado quedó tapado por un header
 * `sticky`/`fixed` (o cualquier elemento fijo de `headerOffsetPx` de alto)
 * al scrollear hacia abajo, falso de nuevo al volver a subir por encima de
 * ese punto — a diferencia de un umbral de scroll fijo en píxeles, esto
 * sigue el LAYOUT real de la página (si el contenido de arriba cambia de
 * alto, el punto de activación se recalcula solo). */
export function useScrollPastElement(ref: RefObject<HTMLElement | null>, headerOffsetPx = 90) {
  const [past, setPast] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting), {
      rootMargin: `-${headerOffsetPx}px 0px 0px 0px`,
      threshold: 0,
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, headerOffsetPx])

  return past
}
