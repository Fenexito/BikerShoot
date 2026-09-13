import iconLight from '../../assets/motogram-icon-light.png'
import iconDark from '../../assets/motogram-icon-dark.png'
import textLight from '../../assets/motogram-text-light.png'
import textDark from '../../assets/motogram-text-dark.png'
import textStudioLight from '../../assets/motogram-text-studio-light.png'
import textStudioDark from '../../assets/motogram-text-studio-dark.png'
import stackedLight from '../../assets/motogram-stacked-light.png'
import stackedDark from '../../assets/motogram-stacked-dark.png'
import studioStackedLight from '../../assets/motogram-studio-light.png'
import studioStackedDark from '../../assets/motogram-studio-dark.png'
import { cn } from '../../lib/cn'

type LogoTheme = 'auto' | 'light' | 'dark'

// `cn()` en este proyecto es un `clsx` simple (sin el merge de
// tailwind-merge) — dos utilidades `h-*` en el mismo string de clases NO se
// resuelven por orden de aparición, así que un tamaño default y un override
// JAMÁS pueden convivir en la misma llamada a `cn`: si el caller pasa su
// propia clase de tamaño, reemplaza al default por completo en vez de
// sumarse (ver el bug real que esto causó: un `h-16` que nunca se aplicaba
// porque `h-9` seguía ganando en el CSS generado).

interface LogoProps {
  className?: string
  iconClassName?: string
  textClassName?: string
  /** 'auto' (default) alterna por CSS según el `.dark` ancestro más cercano
   * (clases `.motogram-*-light/-dark` en index.css — a propósito NO son
   * utilitarios `dark:` de Tailwind: `darkMode: ['class', '.theme-studio.dark']`
   * en tailwind.config.js hace que `dark:` SOLO reaccione dentro de
   * `.theme-studio.dark`, nunca con el `.dark` genérico que gana el portal
   * biker — un CSS plano con `.dark` como selector normal no tiene esa
   * restricción). Las páginas de auth de Studio usan una paleta oscura fija
   * sin esa clase — ahí se fuerza 'dark' explícitamente. */
  theme?: LogoTheme
  /** Palabra al lado del ícono: "Motogram" (biker) o "Motogram Studio"
   * (fotógrafo) — son imágenes de texto distintas, no la misma con un
   * sufijo agregado. */
  variant?: 'biker' | 'studio'
  /** Solo el ícono (moto+obturador), sin texto — para espacios muy angostos. */
  iconOnly?: boolean
}

/** Ícono + palabra en una sola fila, para headers — el diseño no trae un
 * lockup horizontal de una sola pieza, así que ícono y texto son dos
 * imágenes separadas compuestas acá con `flex`. */
export function Logo({ className, iconClassName, textClassName, theme = 'auto', variant = 'biker', iconOnly }: LogoProps) {
  const iconSize = iconClassName ?? 'h-7 w-auto'
  const textSize = textClassName ?? 'h-4 w-auto'
  const [tLight, tDark] = variant === 'studio' ? [textStudioLight, textStudioDark] : [textLight, textDark]
  const label = variant === 'studio' ? 'Motogram Studio' : 'Motogram'

  const icon =
    theme === 'light' ? (
      <img src={iconLight} alt="" className={iconSize} />
    ) : theme === 'dark' ? (
      <img src={iconDark} alt="" className={iconSize} />
    ) : (
      <>
        <img src={iconLight} alt="" className={cn('motogram-icon-light', iconSize)} />
        <img src={iconDark} alt="" className={cn('motogram-icon-dark', iconSize)} />
      </>
    )

  if (iconOnly) return <span className={cn('inline-flex items-center', className)}>{icon}</span>

  const text =
    theme === 'light' ? (
      <img src={tLight} alt={label} className={textSize} />
    ) : theme === 'dark' ? (
      <img src={tDark} alt={label} className={textSize} />
    ) : (
      <>
        <img src={tLight} alt={label} className={cn('motogram-text-light', textSize)} />
        <img src={tDark} alt={label} className={cn('motogram-text-dark', textSize)} />
      </>
    )

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {icon}
      {text}
    </span>
  )
}

interface AuthLogoProps {
  className?: string
  theme?: LogoTheme
  variant?: 'biker' | 'studio'
}

/** Lockup apilado (ícono arriba, palabra abajo) en una sola imagen — para
 * las páginas de login/registro/recuperar contraseña, centrado sobre el
 * formulario. */
export function AuthLogo({ className, theme = 'auto', variant = 'biker' }: AuthLogoProps) {
  const size = className ?? 'h-24 w-auto'
  const [light, dark] = variant === 'studio' ? [studioStackedLight, studioStackedDark] : [stackedLight, stackedDark]
  const label = variant === 'studio' ? 'Motogram Studio' : 'Motogram'

  if (theme === 'light') return <img src={light} alt={label} className={size} />
  if (theme === 'dark') return <img src={dark} alt={label} className={size} />

  return (
    <>
      <img src={light} alt={label} className={cn('motogram-stacked-light', size)} />
      <img src={dark} alt={label} className={cn('motogram-stacked-dark', size)} />
    </>
  )
}
