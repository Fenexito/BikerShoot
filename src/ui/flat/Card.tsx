import { type HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Tint = 'default' | 'blue' | 'emerald' | 'amber'

const tintClasses: Record<Tint, string> = {
  default: 'bg-muted hover:bg-gray-200',
  blue: 'bg-blue-50 hover:bg-blue-100',
  emerald: 'bg-emerald-50 hover:bg-emerald-100',
  amber: 'bg-amber-50 hover:bg-amber-100',
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
