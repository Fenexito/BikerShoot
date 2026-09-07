import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

const WEEKDAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

interface DatePickerProps {
  label?: string
  value: string // 'YYYY-MM-DD'
  onChange: (value: string) => void
  className?: string
  error?: boolean
}

function toISODate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseISODate(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) }
}

/** Reemplazo del <input type="date"> nativo — mismo panel oscuro flotante
 * que FancySelect/Dropdown, con un calendario de mes en vez del control del
 * sistema operativo (que no respeta el sistema visual de la app). */
export function DatePicker({ label, value, onChange, className, error }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const parsed = parseISODate(value)
  const today = new Date()
  const [viewYear, setViewYear] = useState(parsed?.y ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.m ?? today.getMonth())

  useEffect(() => {
    if (!open) return
    const p = parseISODate(value)
    setViewYear(p?.y ?? today.getFullYear())
    setViewMonth(p?.m ?? today.getMonth())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

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

  const cells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1)
    const startWeekday = firstOfMonth.getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const out: (number | null)[] = []
    for (let i = 0; i < startWeekday; i++) out.push(null)
    for (let d = 1; d <= daysInMonth; d++) out.push(d)
    return out
  }, [viewYear, viewMonth])

  function changeMonth(delta: number) {
    let m = viewMonth + delta
    let y = viewYear
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    setViewMonth(m)
    setViewYear(y)
  }

  const label_ = value && parsed ? `${parsed.d} de ${MONTHS[parsed.m]} de ${parsed.y}` : 'Selecciona una fecha'

  return (
    <div ref={rootRef} className={cn('relative flex flex-col gap-1.5', className)}>
      {label && <span className="text-sm font-medium text-foreground">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-12 w-full items-center justify-between gap-2 rounded-full border-2 bg-muted px-4 text-left text-sm text-foreground outline-none transition-colors duration-200',
          open ? 'border-primary bg-background' : error ? 'border-accent' : 'border-transparent hover:bg-border/60',
        )}
      >
        <span className={cn('truncate', !value && 'text-muted-foreground')}>{label_}</span>
        <span className="shrink-0 text-sm">📅</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 origin-top animate-menu-in rounded-2xl border border-white/10 bg-neutral-900 p-4 text-white shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => changeMonth(-1)} className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
              ‹
            </button>
            <span className="text-sm font-semibold capitalize">{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={() => changeMonth(1)} className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-white/40">
            {WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <span key={i} />
              const iso = toISODate(viewYear, viewMonth, d)
              const isSelected = iso === value
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => { onChange(iso); setOpen(false) }}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors',
                    isSelected ? 'bg-white text-black' : 'text-white/80 hover:bg-white/10',
                  )}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
