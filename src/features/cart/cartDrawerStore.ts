import { create } from 'zustand'

interface CartDrawerState {
  open: boolean
  openDrawer: () => void
  closeDrawer: () => void
}

/** El ícono del carrito en el header ya no navega directo a /app/checkout —
 * abre esta vista previa lateral en su lugar, para no sacar al biker de lo
 * que estaba viendo (búsqueda, evento, etc.) solo para revisar el carrito. */
export const useCartDrawerStore = create<CartDrawerState>((set) => ({
  open: false,
  openDrawer: () => set({ open: true }),
  closeDrawer: () => set({ open: false }),
}))
