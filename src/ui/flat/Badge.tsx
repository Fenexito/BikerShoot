import { type HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Tone = 'primary' | 'secondary' | 'accent' | 'dark'

const toneClasses: Record<Tone, string> = {
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  accent: 'bg-accent text-accent-foreground',
  dark: 'border border-white/20 bg-black/70 text-white',
}

export function Badge({
  tone = 'accent',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  )
}
