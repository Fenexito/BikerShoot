import { useStudioTheme } from './themeStore'
import { IconSun, IconMoon } from '../shared/icons'

export function ThemeToggle() {
  const { theme, toggle } = useStudioTheme()

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
      className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
    >
      {theme === 'dark' ? <IconSun className="h-5 w-5" /> : <IconMoon className="h-5 w-5" />}
    </button>
  )
}
