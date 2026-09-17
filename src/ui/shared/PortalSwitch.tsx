import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'

interface PortalSwitchProps {
  current: 'biker' | 'studio'
  /** Los signup mandan a su propio /signup o /studio/signup en vez del
   * login, para no perder el flujo de "crear cuenta" al cambiar de rol. */
  bikerTo?: string
  studioTo?: string
  /** Oculto en el login (ya tiene su propio encabezado "Bienvenido de
   * vuelta"), visible en signup para dejar clarísimo que hay que escoger. */
  label?: string
}

/** Selector grande de rol (biker vs. fotógrafo) — va justo debajo del
 * saludo, arriba del formulario, para que un usuario nuevo elija su rol
 * antes de llenar nada. Mismo lenguaje visual que un selector de tema (dos
 * opciones, una resaltada), no un simple link de texto. */
export function PortalSwitch({ current, bikerTo = '/login', studioTo = '/studio/login', label }: PortalSwitchProps) {
  const navigate = useNavigate()

  return (
    <div className="w-full">
      {label && <p className="mb-2 text-sm font-medium text-muted-foreground">{label}</p>}
      <div className="flex w-full gap-1.5 rounded-2xl bg-muted p-1.5 text-sm font-semibold">
        <button
          type="button"
          onClick={() => navigate(bikerTo)}
          className={cn(
            'flex-1 rounded-xl px-4 py-3 text-sm uppercase tracking-wide transition-colors',
            current === 'biker' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Soy biker
        </button>
        <button
          type="button"
          onClick={() => navigate(studioTo)}
          className={cn(
            'flex-1 rounded-xl px-4 py-3 text-sm uppercase tracking-wide transition-colors',
            current === 'studio' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Soy fotógrafo
        </button>
      </div>
    </div>
  )
}
