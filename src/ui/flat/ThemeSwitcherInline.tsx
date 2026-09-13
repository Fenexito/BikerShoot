import { useFlatTheme } from './themeStore'
import { AnimateIcon } from '../animate-icons/icon'
import { Sun } from '../animate-icons/icons/Sun'
import { Moon } from '../animate-icons/icons/Moon'
import { ThemeToggler } from '../animate-components/theme-toggler-primitive'
import { cn } from '../../lib/cn'

/** Selector de tema de 2 vías dentro del menú de perfil del biker — mismo
 * patrón que `ThemeSwitcherInline` de Studio (el panel del menú de perfil
 * siempre es oscuro sin importar el tema activo de la página, así que el
 * mismo look sirve en los dos portales).
 *
 * Envuelto en `ThemeToggler` (ver ui/animate-components) para que cambiar
 * de tema desde AQUÍ también dispare el barrido circular que crece desde
 * el botón presionado — antes esto solo llamaba `toggle()` directo al
 * store, sin ningún efecto visual más allá del cambio de color.
 *
 * OJO: se pasa `onImmediateChange={setTheme}` (además de `setTheme`) — el
 * `setTheme` "normal" del primitivo solo se llama DESPUÉS de que termine
 * la animación (`.finished.finally(...)`), y ese `.animate()` puede
 * fallar/no completarse en ciertos contextos (pestaña sin foco, API sin
 * soporte) sin lanzar un error visible — dejando el store real sin
 * actualizar aunque el `<html>` sí haya cambiado de clase momentáneamente.
 * `onImmediateChange` se dispara ANTES de todo eso (síncrono, ni bien se
 * hace click), así el tema real del portal (`#portal-theme-root`, que es
 * quien de verdad pinta los colores — no `<html>`) queda correcto pase lo
 * que pase con la animación.
 *
 * Cada botón envuelve su ícono animado con `<AnimateIcon animateOnHover
 * asChild>` — a propósito ENVOLVIENDO EL BOTÓN (no el ícono suelto): así
 * el hover que dispara la animación es el del botón completo (toda su
 * área clicable), no solo el del SVG chico de adentro. */
export function ThemeSwitcherInline() {
  const { theme, setTheme } = useFlatTheme()

  return (
    <ThemeToggler theme={theme} resolvedTheme={theme} setTheme={setTheme} onImmediateChange={setTheme}>
      {({ effective, toggleTheme }) => (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white/70">Tema</span>
          <div className="flex gap-1 rounded-full bg-white/10 p-1">
            <AnimateIcon animateOnHover animateOnTap asChild>
              <button
                onClick={(e) => {
                  if (effective === 'light') return
                  const rect = e.currentTarget.getBoundingClientRect()
                  toggleTheme('light', { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
                }}
                aria-label="Modo claro"
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                  effective === 'light' ? 'bg-white text-neutral-900' : 'text-white/50 hover:text-white/80',
                )}
              >
                <Sun size={16} />
              </button>
            </AnimateIcon>
            <AnimateIcon animateOnHover animateOnTap asChild>
              <button
                onClick={(e) => {
                  if (effective === 'dark') return
                  const rect = e.currentTarget.getBoundingClientRect()
                  toggleTheme('dark', { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
                }}
                aria-label="Modo oscuro"
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                  effective === 'dark' ? 'bg-white text-neutral-900' : 'text-white/50 hover:text-white/80',
                )}
              >
                <Moon size={16} />
              </button>
            </AnimateIcon>
          </div>
        </div>
      )}
    </ThemeToggler>
  )
}
