import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export { TooltipPrimitive }

/** Un solo `Provider` en la raíz de cada portal alcanza — evita que cada
 * `Tooltip` individual tenga que envolverse en su propio provider. */
export const TooltipProvider = TooltipPrimitive.Provider

export interface TooltipProps {
  children: ReactNode
  content: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
  align?: 'start' | 'center' | 'end'
  delayDuration?: number
  className?: string
}

/** Tooltip compartido — mismo patrón que el resto de overlays flotantes de
 * la app (panel oscuro, `animate-menu-in`-style), pero animado con
 * `motion` (fade + un pequeño desplazamiento desde el lado por el que
 * aparece) en vez del fade plano de CSS. Pensado para aclaraciones cortas
 * junto a íconos o campos que lo necesiten — no para contenido largo. */
export function Tooltip({ children, content, side = 'top', sideOffset = 8, align = 'center', delayDuration = 200, className }: TooltipProps) {
  const [open, setOpen] = useState(false)

  const offset = { top: [0, 4], bottom: [0, -4], left: [4, 0], right: [-4, 0] }[side]

  return (
    <TooltipPrimitive.Root open={open} onOpenChange={setOpen} delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal forceMount>
        <AnimatePresence>
          {open && (
            <TooltipPrimitive.Content asChild side={side} sideOffset={sideOffset} align={align}>
              <motion.div
                initial={{ opacity: 0, x: offset[0], y: offset[1] }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: offset[0], y: offset[1] }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className={cn(
                  'z-50 max-w-xs rounded-xl bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg',
                  className,
                )}
              >
                {content}
                <TooltipPrimitive.Arrow className="fill-neutral-900" />
              </motion.div>
            </TooltipPrimitive.Content>
          )}
        </AnimatePresence>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
