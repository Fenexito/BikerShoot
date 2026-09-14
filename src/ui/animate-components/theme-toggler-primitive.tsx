import * as React from 'react'
import { flushSync } from 'react-dom'
import { getPortalRoot } from '../shared/portalRoot'

// Portado a mano desde animate-ui.com (registry/primitives/effects/theme-toggler)
// — el efecto de "barrido" al cambiar de tema NO usa `motion`, usa la View
// Transitions API nativa del navegador (`document.startViewTransition`):
// toma una foto del estado anterior/nuevo y anima un `clip-path` entre
// ambos. Sin cambios de lógica frente al original — solo se quitó 'use
// client' (no aplica fuera de Next.js).
type ThemeSelection = 'light' | 'dark'
type Direction = 'btt' | 'ttb' | 'ltr' | 'rtl'
/** Punto de origen (coordenadas de viewport, ej. el centro del botón que
 * disparó el cambio) — cuando se da, el barrido deja de ser una cortina
 * direccional y pasa a ser un círculo que crece DESDE ese punto hacia
 * afuera, como una onda expansiva. No existe en el componente original de
 * Animate UI — se agregó a pedido, reutilizando el mismo mecanismo de
 * `clipPath` sobre `::view-transition-new(root)`. */
type Origin = { x: number; y: number }

type ChildrenRender =
  | React.ReactNode
  | ((state: {
      resolved: ThemeSelection
      effective: ThemeSelection
      toggleTheme: (theme: ThemeSelection, origin?: Origin) => void
    }) => React.ReactNode)

function getClipKeyframes(direction: Direction): [string, string] {
  switch (direction) {
    case 'ltr':
      return ['inset(0 100% 0 0)', 'inset(0 0 0 0)']
    case 'rtl':
      return ['inset(0 0 0 100%)', 'inset(0 0 0 0)']
    case 'ttb':
      return ['inset(0 0 100% 0)', 'inset(0 0 0 0)']
    case 'btt':
      return ['inset(100% 0 0 0)', 'inset(0 0 0 0)']
    default:
      return ['inset(0 100% 0 0)', 'inset(0 0 0 0)']
  }
}

/** Radio necesario para que el círculo cubra TODA la pantalla desde el
 * punto de origen — la distancia a la esquina más lejana (las 4 esquinas
 * del viewport, la mayor de las 4 gana). */
function getCircleKeyframes(origin: Origin): [string, string] {
  const { innerWidth: w, innerHeight: h } = window
  const radius = Math.max(
    Math.hypot(origin.x, origin.y),
    Math.hypot(w - origin.x, origin.y),
    Math.hypot(origin.x, h - origin.y),
    Math.hypot(w - origin.x, h - origin.y),
  )
  return [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`]
}

type ThemeTogglerProps = {
  theme: ThemeSelection
  resolvedTheme: ThemeSelection
  setTheme: (theme: ThemeSelection) => void
  direction?: Direction
  onImmediateChange?: (theme: ThemeSelection) => void
  children?: ChildrenRender
}

/** El original soporta `theme === 'system'` (con next-themes) — este
 * proyecto no tiene modo "sistema" en sus stores de tema (`useFlatTheme`/
 * `useStudioTheme`, ambos solo light/dark), así que esa rama se omitió; el
 * resto (el `clipPath` animado sobre `::view-transition-new(root)`) es
 * idéntico al original. */
function ThemeToggler({ theme, resolvedTheme, setTheme, onImmediateChange, direction = 'ltr', children, ...props }: ThemeTogglerProps) {
  const [preview, setPreview] = React.useState<null | { effective: ThemeSelection; resolved: ThemeSelection }>(null)
  const [current, setCurrent] = React.useState<{ effective: ThemeSelection; resolved: ThemeSelection }>({
    effective: theme,
    resolved: resolvedTheme,
  })

  React.useEffect(() => {
    if (preview && theme === preview.effective && resolvedTheme === preview.resolved) {
      setPreview(null)
    }
  }, [theme, resolvedTheme, preview])

  const [fromClip, toClip] = getClipKeyframes(direction)

  const toggleTheme = React.useCallback(
    async (theme: ThemeSelection, origin?: Origin) => {
      const resolved = theme
      setCurrent({ effective: theme, resolved })

      const clipPath = origin ? getCircleKeyframes(origin) : [fromClip, toClip]

      // Overlay propio en vez de `document.startViewTransition` — se probó
      // la View Transitions API nativa dándole al header y al menú inferior
      // (`position: fixed`) su propio grupo con nombre para que barrieran
      // junto con el resto en vez de repintarse aparte: en pruebas reales
      // eso resultó en pantallas que Chrome deja "congeladas" mostrando la
      // foto vieja para siempre. También se descubrió la causa real de por
      // qué el header/menú inferior parecían cambiar de golpe ANTES que el
      // resto de la página incluso animando solo `root`: `onImmediateChange`
      // (el que de verdad dispara el cambio de tema real en el store, y por
      // lo tanto todo el repintado de colores) se llamaba aquí arriba, ANTES
      // de que existiera cualquier animación — el repintado real ocurría
      // casi al instante, y el header (con su propia capa de composición al
      // ser `fixed`) se colaba mostrándolo antes de tiempo mientras el resto
      // de la página seguía "congelado" en la foto vieja del navegador.
      // Un overlay manual (un solo `<div>` opaco, encima de TODO —header,
      // menú inferior y cuerpo por igual, sin depender de qué elemento
      // tenga su propia capa) que se abre con una transición de CSS
      // `clip-path` evita ambos problemas: el cambio real de tema ocurre
      // siempre escondido bajo el overlay (nunca se cuela nada antes de
      // tiempo), y la limpieza no depende del ciclo de vida frágil de la
      // View Transitions API — un `transitionend` normal más un
      // `setTimeout` de respaldo garantizan que el overlay siempre se
      // quita, nunca se queda pegado en pantalla.
      const overlay = document.createElement('div')
      overlay.style.position = 'fixed'
      overlay.style.inset = '0'
      overlay.style.zIndex = '2147483647'
      overlay.style.pointerEvents = 'none'
      overlay.style.backgroundColor = 'rgb(var(--color-background))'
      overlay.style.clipPath = clipPath[1]
      // Dentro de `#portal-theme-root` (no `document.body`) — ahí es donde
      // viven las variables CSS del tema activo (`.theme-studio.dark`,
      // etc.); fuera de ese wrapper el overlay caería a los valores de
      // `:root` y podría pintarse del color equivocado.
      getPortalRoot().appendChild(overlay)

      // El cambio real (clase `dark` + el store de tema, que es lo que de
      // verdad repinta colores vía `#portal-theme-root`) ocurre ya, de un
      // solo golpe sincronizado — pero queda escondido bajo el overlay
      // opaco de arriba hasta que este empiece a abrirse.
      flushSync(() => {
        setPreview({ effective: theme, resolved })
        document.documentElement.classList.toggle('dark', resolved === 'dark')
        onImmediateChange?.(theme)
      })

      // Reflow forzado: si no, el navegador junta el clip-path inicial y el
      // final en el mismo frame y la transición nunca se llega a ver.
      void overlay.offsetHeight
      overlay.style.transition = 'clip-path 700ms ease-in-out'
      overlay.style.clipPath = clipPath[0]

      await new Promise<void>((resolve) => {
        let done = false
        const finish = () => {
          if (done) return
          done = true
          overlay.removeEventListener('transitionend', finish)
          resolve()
        }
        overlay.addEventListener('transitionend', finish)
        setTimeout(finish, 900)
      })
      overlay.remove()
      setTheme(theme)
    },
    [onImmediateChange, fromClip, toClip, setTheme],
  )

  return (
    <React.Fragment {...props}>
      {typeof children === 'function' ? children({ effective: current.effective, resolved: current.resolved, toggleTheme }) : children}
    </React.Fragment>
  )
}

export { ThemeToggler, type ThemeTogglerProps, type ThemeSelection, type Direction, type Origin }
