import * as React from 'react'
import { useInView, type UseInViewOptions } from 'motion/react'

// Portado a mano desde el registro de Animate UI (animate-ui.com) — es una
// de las 3 piezas base de las que depende CUALQUIER ícono animado de esa
// librería. Sin cambios de lógica frente al original, solo sin el alias
// `@/...` (este proyecto no usa shadcn/ui ni tiene ese alias configurado).
interface UseIsInViewOptions {
  inView?: boolean
  inViewOnce?: boolean
  inViewMargin?: UseInViewOptions['margin']
}

export function useIsInView<T extends HTMLElement = HTMLElement>(ref: React.Ref<T>, options: UseIsInViewOptions = {}) {
  const { inView, inViewOnce = false, inViewMargin = '0px' } = options
  const localRef = React.useRef<T>(null)
  React.useImperativeHandle(ref, () => localRef.current as T)
  const inViewResult = useInView(localRef, {
    once: inViewOnce,
    margin: inViewMargin,
  })
  const isInView = !inView || inViewResult
  return { ref: localRef, isInView }
}

export type { UseIsInViewOptions }
