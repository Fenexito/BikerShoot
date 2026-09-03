import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useConfirmStore } from './confirmStore'
import { cn } from '../../lib/cn'
import { getPortalRoot } from '../shared/portalRoot'

const CLOSE_DURATION = 150

export function ConfirmDialog() {
  const request = useConfirmStore((s) => s.request)
  const settle = useConfirmStore((s) => s.settle)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    setClosing(false)
  }, [request?.id])

  useEffect(() => {
    if (!request) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id])

  if (!request) return null

  function close(value: boolean) {
    setClosing(true)
    setTimeout(() => settle(value), CLOSE_DURATION)
  }

  const danger = request.tone === 'danger'

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className={cn(
          'absolute inset-0 bg-black/60 transition-opacity duration-150',
          closing ? 'opacity-0' : 'opacity-100',
        )}
        onClick={() => close(false)}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className={cn(
          'relative z-10 w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-foreground shadow-2xl',
          'transition-all duration-150',
          closing ? 'translate-y-1 opacity-0' : 'animate-confirm-in',
        )}
      >
        <h2 id="confirm-dialog-title" className="text-xs font-bold uppercase tracking-wide text-accent">
          {danger ? 'Confirmar eliminación' : 'Confirmar'}
        </h2>
        <p className="mt-3 text-base font-semibold leading-snug">{request.title}</p>
        {request.description && <p className="mt-2 text-sm text-muted-foreground">{request.description}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => close(false)}
            className="rounded-full px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {request.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            onClick={() => close(true)}
            className={cn(
              'rounded-full px-5 py-2.5 text-sm font-semibold transition-all',
              danger ? 'bg-accent text-accent-foreground hover:opacity-90' : 'bg-foreground text-background hover:opacity-90',
            )}
          >
            {request.confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>,
    getPortalRoot(),
  )
}
