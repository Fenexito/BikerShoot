import { create } from 'zustand'

type StudioTheme = 'light' | 'dark'

const STORAGE_KEY = 'motoshots-studio-theme'

function readInitialTheme(): StudioTheme {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'dark'
}

interface StudioThemeState {
  theme: StudioTheme
  toggle: () => void
}

export const useStudioTheme = create<StudioThemeState>((set) => ({
  theme: readInitialTheme(),
  toggle: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark'
      window.localStorage.setItem(STORAGE_KEY, next)
      return { theme: next }
    }),
}))
