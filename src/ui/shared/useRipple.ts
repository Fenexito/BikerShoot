import { useReducedMotion } from 'motion/react'
import { useState, type PointerEvent } from 'react'

export interface Ripple {
  id: number
  x: number
  y: number
  size: number
}

/** Ondas de clic reutilizadas por los botones compartidos (`ui/flat/Button`,
 * `ui/studio/Button`) — un círculo de `currentColor` (toma el color de
 * texto de cada variante, blanco en botones sólidos, oscuro en outline/
 * ghost, sin configurar nada aparte) que crece desde el punto exacto del
 * clic y se desvanece. Con `prefers-reduced-motion` no se generan ondas. */
export function useRipple() {
  const reduced = useReducedMotion() ?? false
  const [ripples, setRipples] = useState<Ripple[]>([])

  function addRipple(event: PointerEvent<HTMLElement>) {
    if (reduced || event.pointerType === 'mouse' && event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 2
    setRipples((r) => [
      ...r,
      { id: Date.now() + Math.random(), x: event.clientX - rect.left - size / 2, y: event.clientY - rect.top - size / 2, size },
    ])
  }

  function removeRipple(id: number) {
    setRipples((r) => r.filter((rp) => rp.id !== id))
  }

  return { ripples, addRipple, removeRipple }
}
