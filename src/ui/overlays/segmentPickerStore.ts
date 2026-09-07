import { create } from 'zustand'

export interface SegmentOption {
  start: string
  end: string
}

export interface SegmentPickerRequest {
  segments: SegmentOption[]
  title?: string
}

interface SegmentPickerState {
  request: (SegmentPickerRequest & { id: string }) | null
  resolve: ((value: SegmentOption | null) => void) | null
  ask: (request: SegmentPickerRequest) => Promise<SegmentOption | null>
  settle: (value: SegmentOption | null) => void
}

export const useSegmentPickerStore = create<SegmentPickerState>((set, get) => ({
  request: null,
  resolve: null,
  ask: (request) =>
    new Promise<SegmentOption | null>((resolve) => {
      set({ request: { ...request, id: crypto.randomUUID() }, resolve })
    }),
  settle: (value) => {
    get().resolve?.(value)
    set({ request: null, resolve: null })
  },
}))

/** Pedir al fotógrafo que elija uno de los horarios declarados de un punto —
 * usar como `await segmentPickerDialog.ask({ segments })`, devuelve `null`
 * si cancela. Mismo patrón que `confirmDialog`. */
export const segmentPickerDialog = {
  ask: (request: SegmentPickerRequest) => useSegmentPickerStore.getState().ask(request),
}
