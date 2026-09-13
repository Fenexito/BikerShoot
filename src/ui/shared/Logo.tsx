import logoLight from '../../assets/motogram-logo-light.png'
import logoDark from '../../assets/motogram-logo-dark.png'
import { cn } from '../../lib/cn'

interface LogoProps {
  className?: string
  /** 'auto' (default) alterna por CSS según el `.dark` ancestro más cercano.
   * Las páginas de auth de Studio usan una paleta oscura fija, sin aplicar
   * esa clase — ahí se fuerza 'dark' explícitamente. */
  theme?: 'auto' | 'light' | 'dark'
}

/** Wordmark de Motogram. En modo 'auto' ambas imágenes se montan siempre y
 * se alternan por CSS puro (clases `.motogram-logo-*` en index.css, no
 * utilitarios `dark:` de Tailwind — esos solo reaccionan dentro de
 * `.theme-studio.dark` por el `darkMode` de tailwind.config.js, y dejarían
 * el logo sin cambiar en el portal biker, cuyo modo oscuro es
 * `.theme-flat.dark`). */
export function Logo({ className, theme = 'auto' }: LogoProps) {
  if (theme === 'light') return <img src={logoLight} alt="Motogram" className={cn('h-8 w-auto', className)} />
  if (theme === 'dark') return <img src={logoDark} alt="Motogram" className={cn('h-8 w-auto', className)} />

  return (
    <>
      <img src={logoLight} alt="Motogram" className={cn('motogram-logo-light h-8 w-auto', className)} />
      <img src={logoDark} alt="Motogram" className={cn('motogram-logo-dark h-8 w-auto', className)} />
    </>
  )
}
