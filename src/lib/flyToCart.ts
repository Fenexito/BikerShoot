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

interface Point {
  x: number
  y: number
}

/** Punto sobre una curva de Bézier cuadrática con el punto de control
 * levantado por encima de la línea recta entre origen y destino — un
 * arco, no una línea. Compartido por las 3 variantes de vuelo, cada una
 * solo cambia qué tan alto se levanta el arco (`arcLift`). */
function arcPoint(start: Point, end: Point, arcLift: number, t: number): Point {
  const controlX = (start.x + end.x) / 2
  const controlY = Math.min(start.y, end.y) - arcLift
  return {
    x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * controlX + t ** 2 * end.x,
    y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * controlY + t ** 2 * end.y,
  }
}

interface FlightPlan {
  keyframes: Keyframe[]
  options: KeyframeAnimationOptions
}

const STEPS = 14

/** Variante 1 — "moneda al aire": la original. Arco medio + una vuelta
 * completa (360°) sobre el eje vertical, como una moneda girando de canto,
 * con `perspective()` en el mismo transform para que de verdad se vea 3D. */
function planCoinFlip(start: Point, end: Point, dist: number): FlightPlan {
  const arcLift = Math.min(160, Math.max(60, dist * 0.35))
  const dir = start.x <= end.x ? 1 : -1
  const keyframes: Keyframe[] = Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = i / STEPS
    const { x, y } = arcPoint(start, end, arcLift, t)
    const rotateY = t * 360 * dir
    const scale = 1 - 0.82 * t ** 1.4
    return {
      transform: `perspective(500px) translate(${x - start.x}px, ${y - start.y}px) rotateY(${rotateY}deg) scale(${scale})`,
      opacity: t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25,
      offset: t,
    }
  })
  return { keyframes, options: { duration: 650, easing: 'cubic-bezier(0.33, 0, 0.2, 1)', fill: 'forwards' } }
}

/** Variante 2 — "planeo": arco bajo y suave, sin voltereta — solo un ligero
 * balanceo de lado a lado (como una hoja cayendo) mientras se encoge hasta
 * el tamaño del ícono destino. Acelera fuerte al final (mismo tipo de
 * curva que un objeto real "cayendo" hacia el carrito, no flotando parejo
 * todo el trayecto). */
function planGlide(start: Point, end: Point, dist: number): FlightPlan {
  const arcLift = Math.min(70, Math.max(20, dist * 0.15))
  const dir = start.x <= end.x ? 1 : -1
  const keyframes: Keyframe[] = Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = i / STEPS
    const { x, y } = arcPoint(start, end, arcLift, t)
    // Balanceo: crece y vuelve a bajar a 0 (seno completo), se asienta
    // justo al llegar — nunca gira del todo, solo se "mece".
    const tilt = Math.sin(t * Math.PI) * 10 * dir
    const scale = 1 - 0.68 * t
    return {
      transform: `translate(${x - start.x}px, ${y - start.y}px) rotate(${tilt}deg) scale(${scale})`,
      opacity: t < 0.92 ? 1 : 1 - (t - 0.92) / 0.08,
      offset: t,
    }
  })
  return { keyframes, options: { duration: 500, easing: 'cubic-bezier(0.74, 0.18, 0.93, 0.69)', fill: 'forwards' } }
}

/** Variante 3 — "lanzamiento": arco alto (como tirar algo a una canasta
 * desde abajo), con una voltereta y media (540°) en vez de una vuelta
 * exacta — se ve más "lanzado" que "girado en el sitio" — y un
 * estira-y-encoge: crece un poco en el punto más alto del arco antes de
 * encogerse fuerte al caer. */
function planToss(start: Point, end: Point, dist: number): FlightPlan {
  const arcLift = Math.min(230, Math.max(110, dist * 0.55))
  const dir = start.x <= end.x ? 1 : -1
  const keyframes: Keyframe[] = Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = i / STEPS
    const { x, y } = arcPoint(start, end, arcLift, t)
    const rotate = t * 540 * dir
    const scale = 1 + 0.12 * Math.sin(t * Math.PI) - 0.85 * t ** 2
    return {
      transform: `perspective(600px) translate(${x - start.x}px, ${y - start.y}px) rotate(${rotate}deg) scale(${Math.max(scale, 0.05)})`,
      opacity: t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2,
      offset: t,
    }
  })
  return { keyframes, options: { duration: 750, easing: 'ease-in-out', fill: 'forwards' } }
}

const FLIGHT_PLANS = [planCoinFlip, planGlide, planToss]

/** Anima una miniatura "volando" desde `sourceRect` hasta el ícono del
 * carrito en el header (`#header-cart-icon`) — puramente decorativo, no
 * afecta el estado real del carrito (eso ya pasó antes de llamar esto).
 * Cada vez se elige al azar una de 3 variantes de vuelo (moneda al aire,
 * planeo, lanzamiento) para que no se sienta repetitiva con el uso
 * diario — el aterrizaje (`impactCartIcon`) es el mismo para las tres, es
 * el remate que las une visualmente. */
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

  const start: Point = { x: sourceRect.left + sourceRect.width / 2, y: sourceRect.top + sourceRect.height / 2 }
  const end: Point = { x: targetRect.left + targetRect.width / 2, y: targetRect.top + targetRect.height / 2 }
  const dist = Math.hypot(end.x - start.x, end.y - start.y)

  const plan = FLIGHT_PLANS[Math.floor(Math.random() * FLIGHT_PLANS.length)](start, end, dist)

  const anim = el.animate(plan.keyframes, plan.options)
  anim.onfinish = () => {
    el.remove()
    impactCartIcon(target!)
  }
  anim.oncancel = () => el.remove()
}

/** El "golpe" que recibe el carrito justo cuando la miniatura que voló
 * termina de llegar — sin esto, el ícono se quedaba estático todo el
 * tiempo y la animación se sentía incompleta, como si la foto
 * desapareciera en el aire en vez de de verdad "caer" en el carrito. Un
 * rebote elástico del propio ícono + un anillo que se expande y se
 * desvanece alrededor — las dos animaciones se miden contra el tamaño
 * real del ícono en pantalla, así se ven bien sin importar en qué header
 * (biker/fotógrafo) o tamaño de pantalla estén. Igual para las 3
 * variantes de vuelo — es el remate que las une visualmente. */
function impactCartIcon(target: HTMLElement) {
  const rect = target.getBoundingClientRect()

  const ring = document.createElement('span')
  ring.style.position = 'fixed'
  ring.style.left = `${rect.left}px`
  ring.style.top = `${rect.top}px`
  ring.style.width = `${rect.width}px`
  ring.style.height = `${rect.height}px`
  ring.style.borderRadius = '9999px'
  ring.style.border = '2px solid currentColor'
  ring.style.color = getComputedStyle(target).color
  ring.style.pointerEvents = 'none'
  ring.style.zIndex = '9999'
  document.body.appendChild(ring)
  const ringAnim = ring.animate(
    [
      { transform: 'scale(1)', opacity: 0.7 },
      { transform: 'scale(2.1)', opacity: 0 },
    ],
    { duration: 500, easing: 'ease-out' },
  )
  ringAnim.onfinish = () => ring.remove()
  ringAnim.oncancel = () => ring.remove()

  target.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.22)' },
      { transform: 'scale(0.93)' },
      { transform: 'scale(1.04)' },
      { transform: 'scale(1)' },
    ],
    { duration: 420, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  )
}
