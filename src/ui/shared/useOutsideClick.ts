import { useEffect, type RefObject } from 'react'

/** Cierra `onOutside` cuando se hace click fuera de `ref` — solo escucha
 * mientras `active` es verdadero (evita registrar el listener global cuando
 * el panel ya está cerrado). */
export function useOutsideClick(ref: RefObject<HTMLElement | null>, onOutside: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [active, onOutside, ref])
}
