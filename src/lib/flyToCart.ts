/** Anima una miniatura "volando" desde `sourceRect` hasta el ícono del
 * carrito en el header (`#header-cart-icon`) — puramente decorativo, no
 * afecta el estado real del carrito (eso ya pasó antes de llamar esto).
 * Es una prueba (pedida explícitamente como tal): si no gusta, se puede
 * quitar el `onClick` que la dispara sin tocar nada del carrito en sí. */
export function flyToCart(sourceRect: DOMRect, imageUrl: string) {
  // Hay más de un ícono de carrito en el DOM a la vez (la capa normal del
  // header y la capa transformada conviven, una de las dos con opacidad 0 —
  // ver HeaderUser.tsx), así que se marcan con el mismo atributo y se toma
  // el primero que de verdad esté visible (rect con tamaño real).
  const candidates = document.querySelectorAll<HTMLElement>('[data-cart-icon]')
  let target: HTMLElement | null = null
  let targetRect: DOMRect | null = null
  for (const el of candidates) {
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
  document.body.appendChild(el)

  const deltaX = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2)
  const deltaY = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2)

  const anim = el.animate(
    [
      { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
      { transform: `translate(${deltaX * 0.55}px, ${deltaY * 0.55 - 40}px) scale(0.55)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.08)`, opacity: 0.3 },
    ],
    { duration: 600, easing: 'cubic-bezier(0.3, 0, 0.6, 1)' },
  )
  anim.onfinish = () => el.remove()
  anim.oncancel = () => el.remove()
}
