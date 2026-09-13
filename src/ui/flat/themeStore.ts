import { create } from 'zustand'

type FlatTheme = 'light' | 'dark'

const STORAGE_KEY = 'motoshots-biker-theme'

function readInitialTheme(): FlatTheme {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  // Sin preferencia guardada, respeta el modo del sistema — a diferencia del
  // portal Studio (que siempre arranca oscuro por diseño), el portal biker
  // no tiene un tema "de marca" fuerte, así que seguir al sistema es el
  // default más cómodo para quien nunca lo tocó.
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

interface FlatThemeState {
  theme: FlatTheme
  toggle: () => void
  /** Fija un valor específico (a diferencia de `toggle`, que solo invierte)
   * — lo necesita `ThemeTogglerButton`/`ThemeToggler` (ver
   * ui/animate-components), que siempre sabe de antemano a qué tema
   * exacto quiere pasar. */
  setTheme: (next: FlatTheme) => void
}

export const useFlatTheme = create<FlatThemeState>((set) => ({
  theme: readInitialTheme(),
  toggle: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark'
      window.localStorage.setItem(STORAGE_KEY, next)
      return { theme: next }
    }),
  setTheme: (next) => {
    window.localStorage.setItem(STORAGE_KEY, next)
    set({ theme: next })
  },
}))
