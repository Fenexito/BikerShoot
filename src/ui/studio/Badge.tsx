import { type HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center border border-border px-2.5 py-1 font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}
