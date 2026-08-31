import { create } from 'zustand'

export interface TypedConfirmRequest {
  title: string
  description?: string
  matchText: string
  matchLabel?: string
  confirmLabel?: string
  cancelLabel?: string
}

interface TypedConfirmState {
  request: (TypedConfirmRequest & { id: string }) | null
  resolve: ((value: boolean) => void) | null
  ask: (request: TypedConfirmRequest) => Promise<boolean>
  settle: (value: boolean) => void
}

export const useTypedConfirmStore = create<TypedConfirmState>((set, get) => ({
  request: null,
  resolve: null,
  ask: (request) =>
    new Promise<boolean>((resolve) => {
      set({ request: { ...request, id: crypto.randomUUID() }, resolve })
    }),
  settle: (value) => {
    get().resolve?.(value)
    set({ request: null, resolve: null })
  },
}))

/** Como confirmDialog, pero exige escribir un texto exacto (ej. el nombre del
 * evento) antes de habilitar el botón — para acciones destructivas en cascada
 * donde un solo clic accidental sería demasiado fácil. */
export const typedConfirmDialog = {
  ask: (request: TypedConfirmRequest) => useTypedConfirmStore.getState().ask(request),
}
