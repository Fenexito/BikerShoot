import { create } from 'zustand'
import type { ReactNode } from 'react'

interface HeaderTransformState {
  content: ReactNode | null
  /** Si el header debe MOSTRAR `content` ahora mismo — lo decide la propia
   * página (no un umbral genérico), porque cada página sabe cuándo tiene
   * sentido transformarse (ej. cuando termina de reducirse su portada). */
  active: boolean
  setTransform: (content: ReactNode | null, active: boolean) => void
}

/** Contenido (y condición de activación) que reemplaza el header por defecto
 * cuando la página actual lo registra — ver `useHeaderTransform`. Vive en un
 * store global (no en contexto de React) porque el header y la página que
 * registra su contenido son hermanos en el árbol (ambos cuelgan de
 * `PortalLayout`, uno renderiza el `<header>` y el otro el `<Outlet/>`), sin
 * relación padre-hijo directa. */
export const useHeaderTransformStore = create<HeaderTransformState>((set) => ({
  content: null,
  active: false,
  setTransform: (content, active) => set({ content, active }),
}))
