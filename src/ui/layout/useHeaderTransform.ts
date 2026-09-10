import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useHeaderTransformStore, type HeaderTransformOptions } from './headerTransformStore'

/** Registra el contenido que el header (Studio o Biker) debe mostrar, y
 * CUÁNDO mostrarlo (`active`) — en vez de los links de navegación normales.
 * `active` lo calcula la propia página (ej. "ya se scrolleó pasado un
 * umbral genérico", o algo más específico como "la portada ya terminó de
 * reducirse"), no un umbral fijo dentro del header. Por defecto solo aplica
 * en escritorio — pasa `{ mobileEnabled: true }` en `options` para que
 * también aplique en móvil (ver `HeaderTransformOptions`).
 *
 * Uso: `useHeaderTransform(<MiToolbarDePagina />, huboScrollSuficiente)`
 * dentro del componente de la página — se limpia solo al desmontar
 * (navegar a otra página). Pasa `null` como contenido (o no llames el hook)
 * en páginas que no participan de esta mecánica.
 *
 * A propósito no memoiza `content` como dependencia — el JSX es una
 * referencia nueva en cada render, así que en vez de perseguir esa
 * identidad simplemente se re-registra en cada render (barato: solo
 * actualiza un valor en un store, no dispara ningún efecto secundario caro)
 * y así los manejadores de eventos que capture (onClick, onChange...) nunca
 * quedan obsoletos. Un efecto aparte, solo con `[]`, limpia al desmontar. */
export function useHeaderTransform(content: ReactNode | null, active: boolean, options?: HeaderTransformOptions) {
  const setTransform = useHeaderTransformStore((s) => s.setTransform)

  useEffect(() => {
    setTransform(content, active, options)
  })

  useEffect(() => {
    return () => setTransform(null, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
