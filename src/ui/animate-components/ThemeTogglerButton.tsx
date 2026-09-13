import { Sun } from '../animate-icons/icons/Sun'
import { Moon } from '../animate-icons/icons/Moon'
import { ThemeToggler, type Direction, type ThemeSelection } from './theme-toggler-primitive'
import { cn } from '../../lib/cn'

// Adaptado desde animate-ui.com (registry/components/buttons/theme-toggler)
// — el original depende de `useTheme` de `next-themes` (Next.js) y de los
// `buttonVariants`/Monitor de su propio sistema (shadcn); este proyecto no
// tiene ninguno de los dos, así que en vez de portar esas piezas se dejó
// el componente DESACOPLADO de cualquier store en particular: recibe
// `theme`/`setTheme` por props, para que el llamador decida de dónde
// vienen (`useFlatTheme` en el portal biker, `useStudioTheme` en el del
// fotógrafo, o un estado local cualquiera, como en la página de muestra).
// Tampoco soporta el modo "system" — ninguno de los stores de este
// proyecto lo tiene. El efecto de barrido (`ThemeToggler`) es idéntico al
// original.
interface ThemeTogglerButtonProps {
  theme: ThemeSelection
  setTheme: (theme: ThemeSelection) => void
  /** Se dispara ANTES de la animación de barrido (en el mismo instante
   * síncrono que el cambio de clase `dark` en `<html>`) — útil cuando algo
   * más en la página (ej. el fondo de una página de muestra) debe cambiar
   * EXACTAMENTE junto con la transición, no después de que termine (que es
   * cuando se llama `setTheme`). */
  onImmediateChange?: (theme: ThemeSelection) => void
  direction?: Direction
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

const SIZE_CLASS: Record<NonNullable<ThemeTogglerButtonProps['size']>, string> = {
  sm: 'h-8 w-8',
  default: 'h-10 w-10',
  lg: 'h-12 w-12',
}

export function ThemeTogglerButton({ theme, setTheme, onImmediateChange, direction = 'ltr', size = 'default', className }: ThemeTogglerButtonProps) {
  return (
    <ThemeToggler theme={theme} resolvedTheme={theme} setTheme={setTheme} onImmediateChange={onImmediateChange} direction={direction}>
      {({ effective, toggleTheme }) => (
        <button
          type="button"
          aria-label={effective === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          onClick={() => toggleTheme(effective === 'dark' ? 'light' : 'dark')}
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full border border-border bg-muted text-foreground transition-colors hover:bg-border',
            SIZE_CLASS[size],
            className,
          )}
        >
          {effective === 'dark' ? <Moon size={18} animateOnHover /> : <Sun size={18} animateOnHover />}
        </button>
      )}
    </ThemeToggler>
  )
}

export type { ThemeTogglerButtonProps }
