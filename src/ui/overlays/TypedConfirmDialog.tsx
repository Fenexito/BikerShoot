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
          'relative z-10 w-full max-w-sm border border-border bg-card p-6 text-foreground',
          'transition-all duration-150',
          closing ? 'translate-y-1 opacity-0' : 'animate-confirm-in',
        )}
      >
        <h2 id="typed-confirm-title" className="font-studio-mono text-xs font-bold uppercase tracking-wider2 text-accent">
          Confirmar eliminación
        </h2>
        <p className="mt-3 text-base font-semibold leading-snug">{request.title}</p>
        {request.description && <p className="mt-2 text-sm text-muted-foreground">{request.description}</p>}

        <label className="mt-5 block">
          <span className="font-studio-mono text-[10px] uppercase tracking-wider2 text-muted-foreground">
            {request.matchLabel ?? `Escribe "${request.matchText}" para confirmar`}
          </span>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches) close(true)
            }}
            className="mt-2 w-full border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            placeholder={request.matchText}
          />
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => close(false)}
            className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider2 text-muted-foreground transition-colors hover:text-foreground"
          >
            {request.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            onClick={() => close(true)}
            disabled={!matches}
            className="border-2 border-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-wider2 text-accent transition-all hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            {request.confirmLabel ?? 'Eliminar'}
          </button>
        </div>
      </div>
    </div>,
    getPortalRoot(),
  )
}
