import { motion, AnimatePresence } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

const SPRING = { type: 'spring', stiffness: 500, damping: 40 } as const

/** Chevron simple que rota con el estado de expandido/colapsado — no el
 * `ChevronRight` de `animate-icons` (ese anima con hover/tap, no con un
 * estado externo; forzarlo a esto sería pelear contra su propio propósito). */
function Chevron({ open }: { open: boolean }) {
  return (
    <motion.svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      animate={{ rotate: open ? 90 : 0 }}
      transition={SPRING}
      className="shrink-0 text-muted-foreground"
    >
      <path d="m9 18 6-6-6-6" />
    </motion.svg>
  )
}

export interface TreeRowProps {
  depth: number
  label: ReactNode
  icon?: ReactNode
  stats?: ReactNode
  hasChildren: boolean
  expanded: boolean
  selected: boolean
  onToggle: () => void
  onSelect: () => void
}

/** Una fila del árbol — clic selecciona (puebla el panel de detalle) Y, si
 * tiene hijos, expande/colapsa a la vez. Indentación por `depth`, resaltado
 * con el color de marca del portal (`accent`) cuando está seleccionada. */
export function TreeRow({ depth, label, icon, stats, hasChildren, expanded, selected, onToggle, onSelect }: TreeRowProps) {
  return (
    <button
      type="button"
      data-no-ripple
      onClick={() => {
        onSelect()
        if (hasChildren) onToggle()
      }}
      style={{ paddingLeft: `${depth * 20 + 12}px` }}
      className={cn(
        'flex w-full items-center gap-2 rounded-xl border py-2.5 pr-3 text-left transition-colors',
        selected ? 'border-accent/50 bg-accent/10' : 'border-transparent hover:bg-muted/60',
      )}
    >
      {hasChildren ? <Chevron open={expanded} /> : <span className="w-[14px] shrink-0" />}
      {icon && <span className="shrink-0 text-base leading-none">{icon}</span>}
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
      {stats && <span className="shrink-0 text-xs text-muted-foreground">{stats}</span>}
    </button>
  )
}

/** Envoltorio de los hijos de una fila — anima la altura entre 0 y su
 * altura real al expandir/colapsar, en vez de aparecer/desaparecer de
 * golpe. `AnimatePresence` los desmonta de verdad al cerrar (no solo los
 * oculta), así una lista larga colapsada no sigue viva en el DOM. */
export function TreeChildren({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={SPRING}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
