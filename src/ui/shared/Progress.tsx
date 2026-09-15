import * as ProgressPrimitive from '@radix-ui/react-progress'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '../../lib/cn'

export interface ProgressProps {
  /** 0-100. Se ignora si `indeterminate` es true. */
  value?: number
  /** Sin valor conocido todavía (ej. una página cargando su chunk) — una
   * barrita corre de un lado a otro en vez de llenarse hasta un %. */
  indeterminate?: boolean
  className?: string
  indicatorClassName?: string
}

const DEFAULT_TRACK = 'w-full bg-muted'

/** Barra de progreso compartida — reemplaza las barras hechas a mano
 * (`<div style={{width: pct+'%'}}>`) por una sola versión animada con
 * `motion` (en vez de solo `transition-all` de CSS) para el caso con valor
 * conocido (subida de fotos), y agrega un modo indeterminado (sin `%`
 * conocido) para las páginas que solo necesitan mostrar "esto está
 * cargando" — pensado en blanco/negro (`bg-foreground`/`bg-muted`, sigue el
 * tema activo solo) para usarse igual en cualquier página de la app.
 *
 * OJO con `className`: sin `tailwind-merge` en el proyecto (`cn` es solo
 * `clsx`), pasar un ancho propio (ej. "w-48") NO se puede simplemente
 * agregar al `w-full` de por defecto — ambas clases quedarían en el mismo
 * string y cuál gana depende del orden en que Tailwind generó esas reglas,
 * no del orden de las clases. Esto fue justo el bug reportado ("la barra
 * de la página de carga ocupa el ancho completo" aunque se le pasara
 * `className="w-48"`). Por eso `className` REEMPLAZA el ancho/color del
 * track por defecto entero en vez de mezclarse — si se quiere conservar
 * `bg-muted`, hay que repetirlo (ej. `className="w-48 bg-muted"`). */
export function Progress({ value = 0, indeterminate, className, indicatorClassName }: ProgressProps) {
  const reduced = useReducedMotion() ?? false
  const track = className ?? DEFAULT_TRACK

  if (indeterminate) {
    return (
      <div className={cn('relative h-1.5 overflow-hidden rounded-full', track)} role="progressbar" aria-label="Cargando">
        <motion.div
          className={cn('absolute inset-y-0 w-1/3 rounded-full bg-foreground', indicatorClassName)}
          animate={reduced ? { opacity: [1, 0.4, 1] } : { x: ['-100%', '250%'] }}
          transition={reduced ? { duration: 1.2, repeat: Infinity } : { duration: 1.1, ease: 'easeInOut', repeat: Infinity }}
        />
      </div>
    )
  }

  return (
    <ProgressPrimitive.Root value={value} className={cn('relative h-1.5 overflow-hidden rounded-full', track)}>
      <ProgressPrimitive.Indicator asChild>
        <motion.div
          className={cn('h-full rounded-full bg-accent', indicatorClassName)}
          initial={false}
          animate={{ width: `${value}%` }}
          transition={reduced ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' }}
        />
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  )
}
