import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTypedConfirmStore } from './typedConfirmStore'
import { getPortalRoot } from '../shared/portalRoot'
import { cn } from '../../lib/cn'

const CLOSE_DURATION = 150

export function TypedConfirmDialog() {
  const request = useTypedConfirmStore((s) => s.request)
  const settle = useTypedConfirmStore((s) => s.settle)
  const [closing, setClosing] = useState(false)
  const [value, setValue] = useState('')

  useEffect(() => {
    setClosing(false)
    setValue('')
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

  function close(result: boolean) {
    setClosing(true)
    setTimeout(() => settle(result), CLOSE_DURATION)
  }

  const matches = value.trim() === request.matchText

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className={cn('absolute inset-0 bg-black/60 transition-opacity duration-150', closing ? 'opacity-0' : 'opacity-100')}
        onClick={() => close(false)}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="typed-confirm-title"
        className={cn(
          'relative z-10 w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-foreground shadow-2xl',
          'transition-all duration-150',
          closing ? 'translate-y-1 opacity-0' : 'animate-confirm-in',
        )}
      >
        <h2 id="typed-confirm-title" className="text-xs font-bold uppercase tracking-wide text-accent">
          Confirmar eliminación
        </h2>
        <p className="mt-3 text-base font-semibold leading-snug">{request.title}</p>
        {request.description && <p className="mt-2 text-sm text-muted-foreground">{request.description}</p>}

        <label className="mt-5 block">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {request.matchLabel ?? `Escribe "${request.matchText}" para confirmar`}
          </span>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches) close(true)
            }}
            className="mt-2 w-full rounded-full border border-border bg-input px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            placeholder={request.matchText}
          />
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => close(false)}
            className="rounded-full px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {request.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            onClick={() => close(true)}
            disabled={!matches}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-all hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
          >
            {request.confirmLabel ?? 'Eliminar'}
          </button>
        </div>
      </div>
    </div>,
    getPortalRoot(),
  )
}
