import { useEffect, useState } from 'react'
import { useToastStore, type Toast } from './toastStore'
import { cn } from '../../lib/cn'

const LIVE_DURATION = 4000
const LEAVE_DURATION = 180

const toneClasses: Record<Toast['type'], string> = {
  success: 'border-l-emerald-500',
  error: 'border-l-accent',
  info: 'border-l-foreground',
}

const toneLabel: Record<Toast['type'], string> = {
  success: 'Listo',
  error: 'Error',
  info: 'Aviso',
}

const toneLabelClass: Record<Toast['type'], string> = {
  success: 'text-emerald-500',
  error: 'text-accent',
  info: 'text-muted-foreground',
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setLeaving(true), LIVE_DURATION)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => dismiss(toast.id), LEAVE_DURATION)
    return () => clearTimeout(timer)
  }, [leaving, toast.id, dismiss])

  return (
    <div
      className={cn(
        'min-w-[280px] max-w-sm border border-border border-l-4 bg-card px-4 py-3.5 text-foreground shadow-lg',
        'transition-all duration-150',
        toneClasses[toast.type],
        leaving ? 'translate-x-6 opacity-0' : 'animate-toast-in',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('text-[10px] font-bold uppercase tracking-widest', toneLabelClass[toast.type])}>
            {toneLabel[toast.type]}
          </p>
          <p className="mt-1 text-sm font-semibold leading-snug">{toast.title}</p>
          {toast.description && <p className="mt-1 text-xs text-muted-foreground">{toast.description}</p>}
        </div>
        <button
          onClick={() => setLeaving(true)}
          aria-label="Cerrar aviso"
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
