import iconLight from '../../assets/motogram-icon-light.png'
import iconDark from '../../assets/motogram-icon-dark.png'
import textLight from '../../assets/motogram-text-light.png'
import textDark from '../../assets/motogram-text-dark.png'
import studioLight from '../../assets/motogram-studio-light.png'
import studioDark from '../../assets/motogram-studio-dark.png'
import { cn } from '../../lib/cn'

interface LogoProps {
  className?: string
  iconClassName?: string
  textClassName?: string
  /** 'auto' (default) alterna por CSS según el `.dark` ancestro más cercano
   * (clases `.motogram-*-light/-dark` en index.css — a propósito NO son
   * utilitarios `dark:` de Tailwind, ver el comentario junto a ellas).
   * Las páginas de auth de Studio usan una paleta oscura fija sin esa
   * clase — ahí se fuerza 'dark' explícitamente. */
  theme?: 'auto' | 'light' | 'dark'
  /** Solo el ícono (moto+obturador), sin la palabra "Motogram" al lado —
   * para espacios muy angostos. */
  iconOnly?: boolean
}

/** Ícono (moto + obturador de cámara) + palabra "Motogram" al lado. Son dos
 * imágenes separadas (no hay un lockup horizontal único) compuestas en un
 * `flex` — el diseño solo trae versiones apiladas (ícono arriba, texto
 * abajo) o cada pieza suelta, así que el lockup horizontal para el header
 * se arma acá. */
export function Logo({ className, iconClassName, textClassName, theme = 'auto', iconOnly }: LogoProps) {
  // `cn()` en este proyecto es un `clsx` simple (sin el merge de
  // tailwind-merge) — dos utilidades `h-*` en el mismo string de clases NO
  // se resuelven por orden de aparición, así que un default y un override
  // JAMÁS pueden convivir en la misma llamada a `cn`: si viene una clase de
  // tamaño propia, reemplaza al default por completo en vez de sumarse.
  const iconSize = iconClassName ?? 'h-7 w-auto'
  const textSize = textClassName ?? 'h-4 w-auto'

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
      <img src={textLight} alt="Motogram" className={textSize} />
    ) : theme === 'dark' ? (
      <img src={textDark} alt="Motogram" className={textSize} />
    ) : (
      <>
        <img src={textLight} alt="Motogram" className={cn('motogram-text-light', textSize)} />
        <img src={textDark} alt="Motogram" className={cn('motogram-text-dark', textSize)} />
      </>
    )

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {icon}
      {text}
    </span>
  )
}

interface StudioLogoProps {
  className?: string
  theme?: 'auto' | 'light' | 'dark'
}

/** Lockup completo de Studio (ícono + "Motogram Studio" en una sola imagen,
 * ya incluye la palabra "Studio") — para el header y las páginas de auth
 * de Studio, que no arman el lockup pieza por pieza como `Logo`. */
export function StudioLogo({ className, theme = 'auto' }: StudioLogoProps) {
  // Ver el comentario en `Logo` sobre por qué el tamaño nunca se combina
  // con `cn()` — un override reemplaza al default en vez de sumarse.
  const size = className ?? 'h-9 w-auto'

  if (theme === 'light') return <img src={studioLight} alt="Motogram Studio" className={size} />
  if (theme === 'dark') return <img src={studioDark} alt="Motogram Studio" className={size} />

  return (
    <>
      <img src={studioLight} alt="Motogram Studio" className={cn('motogram-studio-light', size)} />
      <img src={studioDark} alt="Motogram Studio" className={cn('motogram-studio-dark', size)} />
    </>
  )
}
