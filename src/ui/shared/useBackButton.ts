import { useEffect } from 'react'
import { useBackButtonStore, type BackTarget } from './backButtonStore'

/** Registra el destino del botón "volver" reservado en el header mientras
 * esta página está montada — se limpia solo al desmontar/cambiar de
 * página, así el espacio vuelve a quedar vacío en páginas que no lo usan
 * en vez de arrastrar el destino de la pantalla anterior. */
export function useBackButton(target: BackTarget) {
  const setTarget = useBackButtonStore((s) => s.setTarget)
  useEffect(() => {
    setTarget(target)
    return () => setTarget(null)
  }, [target, setTarget])
}
