import * as SwitchPrimitive from '@radix-ui/react-switch'
import { motion } from 'motion/react'
import { cn } from '../../lib/cn'

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

/** Switch compartido por toda la app — reemplaza los interruptores hechos a
 * mano (antes duplicados en `SettingsPrimitives.tsx` y `StudioSettings.tsx`,
 * cada uno con su propio `<span>` trasladado a mano) por uno solo sobre
 * Radix (accesible: `role="switch"` y `aria-checked` los da la primitiva,
 * no hay que escribirlos) con el thumb animado por `motion` en vez de una
 * transición CSS — el mismo look (pastilla + círculo) que ya tenía la app. */
export function Switch({ checked, onCheckedChange, disabled, className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:pointer-events-none disabled:opacity-50',
        checked ? 'bg-foreground' : 'bg-muted',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb asChild>
        <motion.span
          className="block h-5 w-5 rounded-full bg-background shadow"
          animate={{ x: checked ? 20 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  )
}
