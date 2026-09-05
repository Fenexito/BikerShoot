import { create } from 'zustand'

export interface TypedConfirmRequest {
  title: string
  description?: string
  matchText: string
  matchLabel?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Si se da, agrega un textarea opcional (ej. "motivo de cancelación")
   * debajo del campo de confirmación — su valor viaja en el resultado. */
  extraFieldLabel?: string
  extraFieldPlaceholder?: string
}

export interface TypedConfirmResult {
  confirmed: boolean
  extraValue: string
}

interface TypedConfirmState {
  request: (TypedConfirmRequest & { id: string }) | null
  resolve: ((value: TypedConfirmResult) => void) | null
  ask: (request: TypedConfirmRequest) => Promise<TypedConfirmResult>
  settle: (value: TypedConfirmResult) => void
}

export const useTypedConfirmStore = create<TypedConfirmState>((set, get) => ({
  request: null,
  resolve: null,
  ask: (request) =>
    new Promise<TypedConfirmResult>((resolve) => {
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
