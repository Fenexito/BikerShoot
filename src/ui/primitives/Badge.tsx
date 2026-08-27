import { type HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Tone = 'neutral' | 'success' | 'danger' | 'brand'

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-success-500/10 text-success-600',
  danger: 'bg-danger-500/10 text-danger-600',
  brand: 'bg-brand-500/10 text-brand-700',
}

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  )
}
