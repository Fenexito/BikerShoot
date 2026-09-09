/** Anima una miniatura "volando" desde `sourceRect` hasta el ícono del
 * carrito en el header (`#header-cart-icon`) — puramente decorativo, no
 * afecta el estado real del carrito (eso ya pasó antes de llamar esto).
 * Es una prueba (pedida explícitamente como tal): si no gusta, se puede
 * quitar el `onClick` que la dispara sin tocar nada del carrito en sí. */
export function flyToCart(sourceRect: DOMRect, imageUrl: string) {
  const target = document.getElementById('header-cart-icon')
  if (!target) return
  const targetRect = target.getBoundingClientRect()
  // El ícono del carrito del header vive en `hidden md:flex` — en móvil no
  // existe visualmente y su rect sale en (0,0,0,0). Sin este chequeo la
  // animación "volaría" hacia la esquina superior izquierda de la pantalla.
  if (targetRect.width === 0 || targetRect.height === 0) return

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
