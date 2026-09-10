import { useEffect, useState } from 'react'

/** true por debajo del breakpoint `sm` de Tailwind (640px) — para ajustes
 * que necesitan un NÚMERO en JS (no solo clases responsive), como el mínimo
 * del resizer de tamaño de foto. */
export function useIsNarrowViewport(breakpointPx = 640) {
  const [narrow, setNarrow] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < breakpointPx : false))

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`)
    function onChange() {
      setNarrow(mql.matches)
    }
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [breakpointPx])

  return narrow
}
