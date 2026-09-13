import { useFlatTheme } from './themeStore'
import { AnimateIcon } from '../animate-icons/icon'
import { Sun } from '../animate-icons/icons/Sun'
import { Moon } from '../animate-icons/icons/Moon'
import { cn } from '../../lib/cn'

/** Selector de tema de 2 vías dentro del menú de perfil del biker — mismo
 * patrón que `ThemeSwitcherInline` de Studio (el panel del menú de perfil
 * siempre es oscuro sin importar el tema activo de la página, así que el
 * mismo look sirve en los dos portales).
 *
 * Cada botón envuelve su ícono animado con `<AnimateIcon animateOnHover
 * asChild>` — a propósito ENVOLVIENDO EL BOTÓN (no el ícono suelto): así
 * el hover que dispara la animación es el del botón completo (toda su
 * área clicable), no solo el del SVG chico de adentro. Puesto directo en
 * `<Sun animateOnHover />` el hover solo se detecta sobre el propio
 * trazo del ícono, y el botón tiene bastante más padding alrededor. */
export function ThemeSwitcherInline() {
  const { theme, toggle } = useFlatTheme()

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-white/70">Tema</span>
      <div className="flex gap-1 rounded-full bg-white/10 p-1">
        <AnimateIcon animateOnHover asChild>
          <button
            onClick={() => theme !== 'light' && toggle()}
            aria-label="Modo claro"
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
              theme === 'light' ? 'bg-white text-neutral-900' : 'text-white/50 hover:text-white/80',
            )}
          >
            <Sun size={16} />
          </button>
        </AnimateIcon>
        <AnimateIcon animateOnHover asChild>
          <button
            onClick={() => theme !== 'dark' && toggle()}
            aria-label="Modo oscuro"
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
              theme === 'dark' ? 'bg-white text-neutral-900' : 'text-white/50 hover:text-white/80',
            )}
          >
            <Moon size={16} />
          </button>
        </AnimateIcon>
      </div>
    </div>
  )
}
