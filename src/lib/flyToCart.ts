/** `getComputedStyle(el).opacity` solo devuelve la opacidad DECLARADA en
 * ESE elemento — no la opacidad EFECTIVA/compuesta que se ve en pantalla,
 * que también depende de sus ancestros. En HeaderUser.tsx las clases
 * `opacity-0`/`opacity-100` viven en el DIV que envuelve cada capa (normal
 * o transformada), no en el botón del carrito en sí — así que revisar solo
 * el botón siempre daba `opacity: 1` (su propio valor, nunca tocado),
 * incluso cuando su capa contenedora estaba invisible. Por eso la animación
 * seguía "viendo" el ícono equivocado. Subir por los ancestros hasta
 * `document.body` y revisar cada uno es lo que realmente detecta si el
 * elemento (o cualquier contenedor suyo) está oculto. */
function isReallyVisible(el: HTMLElement): boolean {
  let node: HTMLElement | null = el
  while (node && node !== document.body) {
    const style = getComputedStyle(node)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
    node = node.parentElement
  }
  return true
}

/** Anima una miniatura "volando" desde `sourceRect` hasta el ícono del
 * carrito en el header (`#header-cart-icon`) — puramente decorativo, no
 * afecta el estado real del carrito (eso ya pasó antes de llamar esto).
 * Es una prueba (pedida explícitamente como tal): si no gusta, se puede
 * quitar el `onClick` que la dispara sin tocar nada del carrito en sí. */
export function flyToCart(sourceRect: DOMRect, imageUrl: string) {
  // Hay más de un ícono de carrito en el DOM a la vez (la capa normal del
  // header y la capa transformada conviven, una encima de la otra con
  // opacidad 0 en vez de desmontada — ver HeaderUser.tsx), así que se
  // marcan con el mismo atributo y se toma el primero que de verdad esté
  // visible.
  const candidates = document.querySelectorAll<HTMLElement>('[data-cart-icon]')
  let target: HTMLElement | null = null
  let targetRect: DOMRect | null = null
  for (const el of candidates) {
    if (!isReallyVisible(el)) continue
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      target = el
      targetRect = rect
      break
    }
  }
  if (!target || !targetRect) return

  const el = document.createElement('img')
  el.src = imageUrl
  el.style.position = 'fixed'
  el.style.left = `${sourceRect.left}px`
  el.style.top = `${sourceRect.top}px`
  el.style.width = `${sourceRect.width}px`
  el.style.height = `${sourceRect.height}px`
  el.style.borderRadius = '12px'
  el.style.objectFit = 'cover'
  el.style.zIndex = '9999'
  el.style.pointerEvents = 'none'
  el.style.willChange = 'transform, opacity'
  el.style.transformOrigin = 'center center'
  document.body.appendChild(el)

  const startX = sourceRect.left + sourceRect.width / 2
  const startY = sourceRect.top + sourceRect.height / 2
  const endX = targetRect.left + targetRect.width / 2
  const endY = targetRect.top + targetRect.height / 2

  // Curva de Bézier cuadrática con el punto de control levantado por
  // encima de la línea recta entre origen y destino — un arco, no una
  // línea. La altura del "salto" se adapta a la distancia real para que
  // se sienta proporcional tanto en una tarjeta pegada al header como en
  // una al fondo de la página.
  const dist = Math.hypot(endX - startX, endY - startY)
  const arcLift = Math.min(160, Math.max(60, dist * 0.35))
  const controlX = (startX + endX) / 2
  const controlY = Math.min(startY, endY) - arcLift

  function bezier(t: number) {
    const x = (1 - t) ** 2 * startX + 2 * (1 - t) * t * controlX + t ** 2 * endX
    const y = (1 - t) ** 2 * startY + 2 * (1 - t) * t * controlY + t ** 2 * endY
    return { x, y }
  }

  const STEPS = 12
  const keyframes: Keyframe[] = Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = i / STEPS
    const { x, y } = bezier(t)
    // Una vuelta completa (360°) sobre el eje vertical en horizontal —
    // como una moneda girando de canto — durante todo el trayecto, más un
    // `perspective()` en el mismo transform para que de verdad se vea como
    // un giro en 3D y no un simple achatado horizontal.
    const rotateY = t * 360 * (startX <= endX ? 1 : -1)
    const scale = 1 - 0.82 * t ** 1.4
    return {
      transform: `perspective(500px) translate(${x - startX}px, ${y - startY}px) rotateY(${rotateY}deg) scale(${scale})`,
      opacity: t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25,
      offset: t,
    }
  })

  const anim = el.animate(keyframes, { duration: 650, easing: 'cubic-bezier(0.33, 0, 0.2, 1)', fill: 'forwards' })
  anim.onfinish = () => el.remove()
  anim.oncancel = () => el.remove()
}
