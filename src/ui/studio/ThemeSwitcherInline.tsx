import { useStudioTheme } from './themeStore'
import { IconSun, IconMoon } from '../shared/icons'
import { cn } from '../../lib/cn'

/** Selector de tema de 2 vías dentro del menú de perfil — mismo patrón que
 * el "Theme" inline con iconos que Mobbin pone dentro de su propio menú de
 * perfil, en vez de un botón suelto en el header. */
export function ThemeSwitcherInline() {
  const { theme, toggle } = useStudioTheme()

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-white/70">Tema</span>
      <div className="flex gap-1 rounded-full bg-white/10 p-1">
        <button
          onClick={() => theme !== 'light' && toggle()}
          aria-label="Modo claro"
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
            theme === 'light' ? 'bg-white text-neutral-900' : 'text-white/50 hover:text-white/80',
          )}
        >
          <IconSun className="h-4 w-4" />
        </button>
        <button
          onClick={() => theme !== 'dark' && toggle()}
          aria-label="Modo oscuro"
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
            theme === 'dark' ? 'bg-white text-neutral-900' : 'text-white/50 hover:text-white/80',
          )}
        >
          <IconMoon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
