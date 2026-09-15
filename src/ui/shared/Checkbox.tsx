import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { motion, useReducedMotion } from 'motion/react'
import type { MouseEvent } from 'react'

export interface CheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  'aria-label'?: string
}

const DEFAULT_ROOT_CLASS =
  'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-border bg-background transition-colors disabled:pointer-events-none disabled:opacity-50 data-[state=checked]:border-accent data-[state=checked]:bg-accent'

/** Checkbox compartido por toda la app — sobre Radix (accesible: el
 * `role="checkbox"` y el estado lo maneja la primitiva) con el check
 * dibujándose por trazo (`pathLength`) en vez de aparecer de golpe.
 *
 * OJO con `className`: sin `tailwind-merge` en el proyecto (`cn` es solo
 * `clsx`), pasar un `className` que choque con el look por defecto (ej. la
 * insignia circular de "seleccionar foto", que necesita `rounded-full` en
 * vez de `rounded-md`) dejaría ambas clases en el string sin ganador
 * predecible. Por eso `className` REEMPLAZA el look por defecto entero en
 * vez de mezclarse con él — cuando se da, hay que repetir cualquier clase
 * base que todavía se quiera conservar. */
export function Checkbox({ checked, onCheckedChange, disabled, className, ...props }: CheckboxProps) {
  const reduced = useReducedMotion() ?? false
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      disabled={disabled}
      className={className ?? DEFAULT_ROOT_CLASS}
      {...props}
    >
      <CheckboxPrimitive.Indicator forceMount asChild>
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3 w-3 text-white"
          initial={false}
          animate={{ opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.1 }}
        >
          <motion.path
            d="M4 12.5 9.5 18 20 7"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
          />
        </motion.svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
