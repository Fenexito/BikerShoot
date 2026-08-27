import { useStudioTheme } from './themeStore'

export function ThemeToggle() {
  const { theme, toggle } = useStudioTheme()

  return (
    <button
      onClick={toggle}
      aria-label="Cambiar tema"
      className="font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground transition-colors duration-150 hover:text-foreground"
    >
      {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
    </button>
  )
}
