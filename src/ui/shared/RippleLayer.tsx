import { AnimatePresence, motion } from 'motion/react'
import type { Ripple } from './useRipple'

/** Capa absoluta con las ondas activas — vive dentro de un botón con
 * `relative overflow-hidden`. Compartida por `ui/flat/Button` y
 * `ui/studio/Button` para no duplicar el markup en los dos. */
export function RippleLayer({ ripples, onDone }: { ripples: Ripple[]; onDone: (id: number) => void }) {
  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <AnimatePresence>
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            onAnimationComplete={() => onDone(r.id)}
            initial={{ scale: 0, opacity: 0.35 }}
            animate={{ scale: 1, opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute rounded-full bg-current"
            style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
          />
        ))}
      </AnimatePresence>
    </span>
  )
}
