import { type HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  bordered?: boolean
  highlighted?: boolean
}

export function Card({ bordered = true, highlighted = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'relative bg-transparent p-6 transition-colors duration-150 md:p-8',
        bordered && 'border border-border hover:border-border-hover',
        highlighted && 'border-2 border-accent hover:border-accent',
        className,
      )}
      {...props}
    >
      {highlighted && (
        <span className="absolute -top-3 left-6 bg-accent px-3 py-1 font-studio-mono text-xs uppercase tracking-wider2 text-accent-foreground">
          Destacado
        </span>
      )}
      {children}
    </div>
  )
}
