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
 * se alternan por CSS (no por estado) para que no haya parpadeo al cambiar
 * de tema; `dark:` reacciona al mismo `.dark` en ambos portales (ver
 * `darkMode` en tailwind.config.js). */
export function Logo({ className, theme = 'auto' }: LogoProps) {
  if (theme === 'light') return <img src={logoLight} alt="Motogram" className={cn('h-8 w-auto', className)} />
  if (theme === 'dark') return <img src={logoDark} alt="Motogram" className={cn('h-8 w-auto', className)} />

  return (
    <>
      <img src={logoLight} alt="Motogram" className={cn('h-8 w-auto dark:hidden', className)} />
      <img src={logoDark} alt="Motogram" className={cn('hidden h-8 w-auto dark:block', className)} />
    </>
  )
}
