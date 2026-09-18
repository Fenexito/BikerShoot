import { type HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Tint = 'default' | 'blue' | 'emerald' | 'amber'

// `dark:hover:*` en las cuatro — sin esto, el hover usa un gris/color claro
// fijo sin importar el tema, así que en modo oscuro una tarjeta se veía
// "saltar" a blanco al pasar el mouse (ej. las del checkout: teléfono,
// subtotal, forma de pago).
const tintClasses: Record<Tint, string> = {
  default: 'bg-muted hover:bg-gray-200 dark:hover:bg-white/10',
  blue: 'bg-blue-50 hover:bg-blue-100 dark:hover:bg-blue-100/20',
  emerald: 'bg-emerald-50 hover:bg-emerald-100 dark:hover:bg-emerald-100/20',
  amber: 'bg-amber-50 hover:bg-amber-100 dark:hover:bg-amber-100/20',
}

export function Card({
  tint = 'default',
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tint?: Tint }) {
  return (
    <div
      className={cn(
        'group cursor-pointer rounded-3xl p-6 transition-all duration-200 hover:scale-[1.01] md:p-8',
        tintClasses[tint],
        className,
      )}
      {...props}
    />
  )
}
