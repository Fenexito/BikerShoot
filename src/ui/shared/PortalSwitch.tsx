import { motion } from 'motion/react'
import { useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'

const SPRING = { type: 'spring', stiffness: 500, damping: 40 } as const

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

/** Switch real de rol (biker vs. fotógrafo) — un fondo compartido
 * (`layoutId` de `motion`, mismo patrón que `UnderlineTabs`) se DESLIZA
 * de una opción a la otra en vez de que cada botón prenda/apague su
 * propio fondo por separado (eso se sentía como dos botones, no como un
 * switch). Chico y de ancho natural (no `w-full`) — va justo debajo del
 * saludo, arriba del formulario, para que un usuario nuevo note que
 * existe y elija su rol antes de llenar nada, sin dominar la pantalla. */
export function PortalSwitch({ current, bikerTo = '/login', studioTo = '/studio/login', label }: PortalSwitchProps) {
  const navigate = useNavigate()
  const groupId = useId()

  const options: { value: 'biker' | 'studio'; to: string; text: string }[] = [
    { value: 'biker', to: bikerTo, text: 'Soy biker' },
    { value: 'studio', to: studioTo, text: 'Soy fotógrafo' },
  ]

  return (
    <div>
      {label && <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>}
      <div className="inline-flex gap-1 rounded-full bg-muted p-1 text-xs font-semibold">
        {options.map((o) => {
          const active = o.value === current
          return (
            <button
              key={o.value}
              type="button"
              data-no-ripple
              onClick={() => navigate(o.to)}
              className={cn(
                'relative rounded-full px-4 py-2 uppercase tracking-wide transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {active && (
                <motion.span
                  layoutId={`portal-switch-${groupId}`}
                  className="absolute inset-0 rounded-full bg-background shadow-sm"
                  transition={SPRING}
                />
              )}
              <span className="relative">{o.text}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
