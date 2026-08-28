import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  photoId: string
  eventId: string
  eventTitle: string
  photographerName: string
  price: number
  seed: string
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
    { name: 'motoshots-cart' },
  ),
)
