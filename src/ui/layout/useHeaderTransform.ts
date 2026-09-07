import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useHeaderTransformStore } from './headerTransformStore'

/** Registra el contenido que el header (Studio o Biker) debe mostrar en su
 * franja central una vez que el usuario hace scroll pasado el umbral — en
 * vez de los links de navegación normales. Solo aplica en escritorio (el
 * header lo renderiza dentro de un `hidden md:flex`); en móvil este
 * contenido simplemente nunca se ve.
 *
 * Uso: `useHeaderTransform(<MiToolbarDePagina />)` dentro del componente de
 * la página — se limpia solo al desmontar (navegar a otra página). Pasa
 * `null` (o no llames el hook) en páginas que no participan de esta
 * mecánica; el header vuelve a su nav por defecto automáticamente.
 *
 * A propósito no memoiza `content` como dependencia — el JSX es una
 * referencia nueva en cada render, así que en vez de perseguir esa
 * identidad simplemente se re-registra en cada render (barato: solo
 * actualiza un valor en un store, no dispara ningún efecto secundario caro)
 * y así los manejadores de eventos que capture (onClick, onChange...) nunca
 * quedan obsoletos. Un efecto aparte, solo con `[]`, limpia al desmontar. */
export function useHeaderTransform(content: ReactNode | null) {
  const setContent = useHeaderTransformStore((s) => s.setContent)

  useEffect(() => {
    setContent(content)
  })

  useEffect(() => {
    return () => setContent(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
