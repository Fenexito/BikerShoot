import { create } from 'zustand'

export interface ConfirmRequest {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'neutral'
}

interface ConfirmState {
  request: (ConfirmRequest & { id: string }) | null
  resolve: ((value: boolean) => void) | null
  ask: (request: ConfirmRequest) => Promise<boolean>
  settle: (value: boolean) => void
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
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

/** Reemplazo de window.confirm() — usar como `await confirmDialog.ask({ title, description })`. */
export const confirmDialog = {
  ask: (request: ConfirmRequest) => useConfirmStore.getState().ask(request),
}
