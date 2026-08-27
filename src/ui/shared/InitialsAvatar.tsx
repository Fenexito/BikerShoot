import { cn } from '../../lib/cn'

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function InitialsAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center font-bold', className)}>
      {getInitials(name)}
    </div>
  )
}
