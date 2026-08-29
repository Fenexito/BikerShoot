import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  photoId: string
  eventId: string
  eventTitle: string
  photographerId: string
  photographerName: string
  price: number
  storagePath: string
  previewPath: string | null
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
      version: 2,
      migrate: (persisted) => {
        const state = persisted as { items?: CartItem[] }
        // Carritos de versiones viejas no tenían photographerId/previewPath —
        // se descartan en vez de romper el checkout con un valor faltante.
        if (state?.items?.some((i) => !('photographerId' in i) || !('previewPath' in i))) return { items: [] }
        return state as CartState
      },
    },
  ),
)
