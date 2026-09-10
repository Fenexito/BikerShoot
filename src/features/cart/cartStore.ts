import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  photoId: string
  eventId: string
  eventTitle: string
  photographerId: string
  photographerName: string
  price: number
  storagePath: string | null
  previewPath: string | null
  /** Nombre del archivo tal como lo subió el fotógrafo — se muestra en el
   * carrito para distinguir fotos del mismo punto/evento que, de otro modo,
   * solo mostrarían el mismo precio repetido sin ninguna otra pista de
   * cuál es cuál. */
  originalFilename: string | null
}

interface CartState {
  items: CartItem[]
  add: (item: CartItem) => void
  remove: (photoId: string) => void
  has: (photoId: string) => boolean
  clear: () => void
  total: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) =>
        set((state) => (state.items.some((i) => i.photoId === item.photoId) ? state : { items: [...state.items, item] })),
      remove: (photoId) => set((state) => ({ items: state.items.filter((i) => i.photoId !== photoId) })),
      has: (photoId) => get().items.some((i) => i.photoId === photoId),
      clear: () => set({ items: [] }),
      total: () => get().items.reduce((sum, i) => sum + i.price, 0),
    }),
    {
      name: 'motoshots-cart',
      version: 3,
      migrate: (persisted) => {
        const state = persisted as { items?: CartItem[] }
        // Carritos de versiones viejas no tenían photographerId/previewPath —
        // se descartan en vez de romper el checkout con un valor faltante.
        // `originalFilename` es nuevo pero no crítico (solo se usa para
        // mostrar) — a un carrito viejo que no lo tenga simplemente se le
        // rellena en null, no hace falta descartarlo por eso.
        if (state?.items?.some((i) => !('photographerId' in i) || !('previewPath' in i))) return { items: [] }
        return { ...state, items: (state.items ?? []).map((i) => ({ ...i, originalFilename: i.originalFilename ?? null })) } as CartState
      },
    },
  ),
)
