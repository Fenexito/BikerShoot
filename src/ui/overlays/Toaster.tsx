import { useEffect } from 'react'
import { useToastStore, type Toast } from './toastStore'
import { cn } from '../../lib/cn'

const toneClasses: Record<Toast['type'], string> = {
  success: 'border-success-500 bg-success-500/10 text-success-600',
  error: 'border-danger-500 bg-danger-500/10 text-danger-600',
  info: 'border-brand-500 bg-brand-500/10 text-brand-700',
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, dismiss])

  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3 shadow-card min-w-[260px]',
        toneClasses[toast.type],
      )}
    >
      <p className="text-sm font-semibold">{toast.title}</p>
      {toast.description && <p className="text-xs opacity-80">{toast.description}</p>}
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
