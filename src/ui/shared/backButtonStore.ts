import { create } from 'zustand'

/** Destino del botón "volver" reservado en el header: una ruta fija
 * ("/studio/eventos") o el sentinel 'back' para simplemente regresar en el
 * historial del navegador (útil en páginas alcanzables desde varios
 * lugares — buscador, mapa, favoritos — donde no hay un único "padre"). */
export type BackTarget = string | 'back' | null

interface BackButtonState {
  target: BackTarget
  setTarget: (target: BackTarget) => void
}

export const useBackButtonStore = create<BackButtonState>((set) => ({
  target: null,
  setTarget: (target) => set({ target }),
}))
