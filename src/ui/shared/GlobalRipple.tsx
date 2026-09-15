import { useEffect } from 'react'

const RIPPLE_MS = 550

/** Ripple de clic para TODA la app — un solo listener delegado (montado una
 * vez en `PortalLayout`) en vez de tener que tocar cada botón custom uno
 * por uno (modales de confirmación, buscadores, botones sueltos de colores
 * distintos que no pasan por `ui/flat/Button`/`ui/studio/Button`). Detecta
 * cualquier `<button>`/`[role="button"]` real que reciba un clic y le
 * agrega la onda ahí mismo, con DOM plano (nada de React state) — así
 * funciona igual sin importar qué componente sea el dueño de ese botón.
 *
 * El color de la onda es `currentColor` (el color de TEXTO del botón en
 * ese momento) — blanco en botones sólidos oscuros/de color, oscuro en
 * botones outline/ghost claros, sin tener que configurar nada por botón.
 *
 * Un botón puede optar por no tener ripple con `data-no-ripple` (ningún
 * lugar de la app lo usa todavía, pero queda disponible por si algún botón
 * muy chico o con su propio feedback visual no lo necesita). */
export function GlobalRipple() {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) return

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return
      const target = (e.target as Element | null)?.closest('button, [role="button"]') as HTMLElement | null
      if (!target) return
      if (target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true') return
      if (target.dataset.noRipple !== undefined) return

      const style = getComputedStyle(target)
      // La mayoría de los botones ya son `relative` (para sus propios
      // badges/overlays) — si no, se vuelve `relative` sin mover nada (es
      // el único valor de `position` que no cambia el layout), así el
      // wrapper de abajo se puede anclar a SUS límites y no a los del
      // ancestro posicionado más cercano.
      if (style.position === 'static') target.style.position = 'relative'

      const rect = target.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 2
      const x = e.clientX - rect.left - size / 2
      const y = e.clientY - rect.top - size / 2

      // El recorte (`overflow:hidden` + el mismo `border-radius` del
      // botón) vive en un wrapper propio, no en el botón — así nunca se le
      // pisa un `overflow` que el botón necesite para otra cosa (ej. un
      // menú flotante que cuelga de él).
      const clip = document.createElement('span')
      clip.style.cssText = `position:absolute;inset:0;overflow:hidden;border-radius:${style.borderRadius};pointer-events:none;`
      const dot = document.createElement('span')
      dot.style.cssText = [
        'position:absolute',
        `left:${x}px`,
        `top:${y}px`,
        `width:${size}px`,
        `height:${size}px`,
        'border-radius:9999px',
        'background:currentColor',
        'opacity:0.35',
        'transform:scale(0)',
        `transition:transform ${RIPPLE_MS}ms ease-out, opacity ${RIPPLE_MS}ms ease-out`,
      ].join(';')
      clip.appendChild(dot)
      target.appendChild(clip)

      requestAnimationFrame(() => {
        dot.style.transform = 'scale(1)'
        dot.style.opacity = '0'
      })
      setTimeout(() => clip.remove(), RIPPLE_MS + 50)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return null
}
