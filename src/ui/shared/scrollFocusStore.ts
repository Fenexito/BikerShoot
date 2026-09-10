import { create } from 'zustand'

interface ScrollFocusState {
  /** true mientras un scroll PROGRAMÁTICO (no del usuario) está en curso —
   * ej. centrar en pantalla la foto que se acaba de cerrar en el visor.
   * `useAutoHideHeader` lo revisa para no ocultar/mostrar el header ni el
   * menú inferior a mitad de esa animación: hacerlo competía visualmente
   * con el scroll-into-view y la foto terminaba perdiendo el centrado. */
  suppressed: boolean
  suppress: () => void
  release: () => void
}

export const useScrollFocusStore = create<ScrollFocusState>((set) => ({
  suppressed: false,
  suppress: () => set({ suppressed: true }),
  release: () => set({ suppressed: false }),
}))
