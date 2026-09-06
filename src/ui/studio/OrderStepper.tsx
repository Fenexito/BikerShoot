import { motion } from 'motion/react'
import { cn } from '../../lib/cn'

// Adaptado del componente Stepper de reactbits.dev (solo la parte visual del
// indicador de pasos + conector animado — el wizard interactivo original no
// aplica aquí, esto es un estado de solo lectura). Colores llevados al acento
// del sistema (vermillion) en vez del morado original.

interface OrderStepperProps {
  steps: string[]
  currentIndex: number
  className?: string
}

export function OrderStepper({ steps, currentIndex, className }: OrderStepperProps) {
  return (
    // Los 4 pasos deben caber SIEMPRE en una sola fila, incluso en pantallas
    // angostas — en vez de dejar que el texto de cada etiqueta empuje el
    // ancho total (causando scroll horizontal), solo el paso activo muestra
    // su etiqueta en móvil; los demás quedan como círculo solo (secundarios,
    // ya completados o por completar). En escritorio (sm:) las 4 etiquetas
    // se ven siempre, hay espacio de sobra.
    <div className={cn('flex w-full items-center py-1.5', className)}>
      {steps.map((label, i) => {
        const isFinalStep = i === steps.length - 1
        const status = i < currentIndex || (i === currentIndex && isFinalStep) ? 'complete' : i === currentIndex ? 'active' : 'inactive'
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5 sm:gap-2">
              <motion.div
                animate={status}
                initial={false}
                variants={{
                  inactive: { backgroundColor: 'rgb(var(--color-muted))', color: 'rgb(var(--color-muted-foreground))', scale: 1 },
                  active: { backgroundColor: 'rgb(var(--color-foreground))', color: 'rgb(var(--color-background))', scale: 1.1 },
                  complete: { backgroundColor: 'rgb(var(--color-foreground))', color: 'rgb(var(--color-background))', scale: 1 },
                }}
                transition={{ duration: 0.3 }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-foreground text-[11px] font-bold sm:h-9 sm:w-9 sm:text-xs"
              >
                {status === 'complete' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5 sm:h-4 sm:w-4">
                    <motion.path
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 0.1, duration: 0.3, ease: 'easeOut' }}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </motion.div>
              <span
                className={cn(
                  'whitespace-nowrap text-center text-[9px] uppercase tracking-wide text-muted-foreground sm:text-[10px]',
                  status !== 'active' && 'hidden sm:inline',
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="mx-1 h-0.5 flex-1 bg-border sm:mx-2">
                <motion.div
                  className="h-full bg-foreground"
                  initial={false}
                  animate={{ width: i < currentIndex ? '100%' : '0%' }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
