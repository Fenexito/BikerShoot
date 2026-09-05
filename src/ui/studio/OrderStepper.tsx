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
    <div className={cn('flex w-full items-center overflow-x-auto', className)}>
      {steps.map((label, i) => {
        const isFinalStep = i === steps.length - 1
        const status = i < currentIndex || (i === currentIndex && isFinalStep) ? 'complete' : i === currentIndex ? 'active' : 'inactive'
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <motion.div
                animate={status}
                initial={false}
                variants={{
                  inactive: { backgroundColor: 'rgb(var(--color-muted))', color: 'rgb(var(--color-muted-foreground))', scale: 1 },
                  active: { backgroundColor: 'rgb(var(--color-foreground))', color: 'rgb(var(--color-background))', scale: 1.1 },
                  complete: { backgroundColor: 'rgb(var(--color-foreground))', color: 'rgb(var(--color-background))', scale: 1 },
                }}
                transition={{ duration: 0.3 }}
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-foreground text-xs font-bold"
              >
                {status === 'complete' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4">
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
              <span className="whitespace-nowrap text-center text-[10px] uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="mx-2 h-0.5 flex-1 bg-border">
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
