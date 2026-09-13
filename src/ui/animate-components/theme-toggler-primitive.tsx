import * as React from 'react'
import { flushSync } from 'react-dom'

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
      onImmediateChange?.(theme)

      if (!document.startViewTransition) {
        flushSync(() => {
          setPreview({ effective: theme, resolved })
        })
        setTheme(theme)
        return
      }

      await document.startViewTransition(() => {
        flushSync(() => {
          setPreview({ effective: theme, resolved })
          document.documentElement.classList.toggle('dark', resolved === 'dark')
        })
      }).ready

      const clipPath = origin ? getCircleKeyframes(origin) : [fromClip, toClip]

      document.documentElement
        .animate(
          { clipPath },
          {
            duration: 700,
            easing: 'ease-in-out',
            pseudoElement: '::view-transition-new(root)',
          },
        )
        .finished.finally(() => {
          setTheme(theme)
        })
    },
    [onImmediateChange, fromClip, toClip, setTheme],
  )

  return (
    <React.Fragment {...props}>
      {typeof children === 'function' ? children({ effective: current.effective, resolved: current.resolved, toggleTheme }) : children}
      <style>{`::view-transition-old(root), ::view-transition-new(root){animation:none;mix-blend-mode:normal;}`}</style>
    </React.Fragment>
  )
}

export { ThemeToggler, type ThemeTogglerProps, type ThemeSelection, type Direction, type Origin }
