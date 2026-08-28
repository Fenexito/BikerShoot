import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FavoritesState {
  ids: string[]
  toggle: (photoId: string) => void
  has: (photoId: string) => boolean
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (photoId) =>
        set((state) => ({
          ids: state.ids.includes(photoId) ? state.ids.filter((id) => id !== photoId) : [...state.ids, photoId],
        })),
      has: (photoId) => get().ids.includes(photoId),
    }),
    { name: 'motoshots-favorites' },
  ),
)
