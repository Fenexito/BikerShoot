import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

const TIMES: string[] = []
for (let h = 0; h < 24; h++) {
  for (const m of [0, 15, 30, 45]) {
    TIMES.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

interface TimePickerProps {
  label?: string
  value: string // 'HH:MM'
  onChange: (value: string) => void
  className?: string
}

/** Reemplazo del <input type="time"> nativo — los fotógrafos solo necesitan
 * intervalos de 15 minutos (así clasifican sus fotos en la práctica), así
 * que en vez de un selector con segundos/minutos arbitrarios del sistema
 * operativo, esto es una lista corta y directa. */
export function TimePicker({ label, value, onChange, className }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector('[data-selected="true"]') as HTMLElement | null
    el?.scrollIntoView({ block: 'center' })
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative flex flex-col gap-1.5', className)}>
      {label && <span className="text-sm font-medium text-foreground">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-12 w-full items-center justify-between gap-2 rounded-full border-2 bg-muted px-4 text-left text-sm text-foreground outline-none transition-colors duration-200',
          open ? 'border-primary bg-background' : 'border-transparent hover:bg-border/60',
        )}
      >
        <span>{value || '--:--'}</span>
        <span className="shrink-0 text-sm">🕒</span>
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute left-0 top-full z-50 mt-2 max-h-60 w-32 origin-top animate-menu-in overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900 py-1.5 text-white shadow-2xl"
        >
          {TIMES.map((t) => (
            <button
              type="button"
              key={t}
              data-selected={t === value}
              onClick={() => { onChange(t); setOpen(false) }}
              className={cn(
                'block w-full px-4 py-2 text-left text-sm font-medium transition-colors hover:bg-white/10',
                t === value ? 'bg-white/10 text-white' : 'text-white/70',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
