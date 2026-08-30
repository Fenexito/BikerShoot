import { cn } from '../../lib/cn'

interface StatusPillProps {
  dot: string
  text: string
  label: string
  className?: string
}

export function StatusPill({ dot, text, label, className }: StatusPillProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', text, className)}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} />
      {label}
    </span>
  )
}
