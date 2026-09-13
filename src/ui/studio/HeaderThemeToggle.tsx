import { useStudioTheme } from './themeStore'
import { AnimateIcon } from '../animate-icons/icon'
import { Sun } from '../animate-icons/icons/Sun'
import { Moon } from '../animate-icons/icons/Moon'
import { ThemeToggler } from '../animate-components/theme-toggler-primitive'

/** Botón fijo de tema en el header (antes vivía dentro del menú flotante de
 * perfil, invisible en móvil porque ese menú es solo de escritorio) — un
 * solo ícono que alterna sol/luna con el mismo barrido circular que el
 * resto de selectores de tema. */
export function HeaderThemeToggle() {
  const { theme, setTheme } = useStudioTheme()

  return (
    <ThemeToggler theme={theme} resolvedTheme={theme} setTheme={setTheme} onImmediateChange={setTheme}>
      {({ effective, toggleTheme }) => (
        <AnimateIcon animateOnHover animateOnTap asChild>
          <button
            onClick={(e) => {
              const next = effective === 'dark' ? 'light' : 'dark'
              const rect = e.currentTarget.getBoundingClientRect()
              toggleTheme(next, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
            }}
            aria-label={effective === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title="Tema"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-border"
          >
            {effective === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </AnimateIcon>
      )}
    </ThemeToggler>
  )
}
