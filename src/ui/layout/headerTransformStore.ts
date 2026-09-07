import { create } from 'zustand'
import type { ReactNode } from 'react'

interface HeaderTransformState {
  content: ReactNode | null
  setContent: (content: ReactNode | null) => void
}

/** Contenido que reemplaza el nav/buscador por defecto del header cuando la
 * página actual lo registra y el usuario ha hecho scroll — ver
 * `useHeaderTransform`. Vive en un store global (no en contexto de React)
 * porque el header y la página que registra su contenido son hermanos en el
 * árbol (ambos cuelgan de `PortalLayout`, uno renderiza el `<header>` y el
 * otro el `<Outlet/>`), sin relación padre-hijo directa. */
export const useHeaderTransformStore = create<HeaderTransformState>((set) => ({
  content: null,
  setContent: (content) => set({ content }),
}))
