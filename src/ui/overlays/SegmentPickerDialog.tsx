import { createPortal } from 'react-dom'
import { useSegmentPickerStore } from './segmentPickerStore'
import { getPortalRoot } from '../shared/portalRoot'

/** Modal que aparece justo después de elegir archivos para subir, cuando el
 * punto tiene horarios declarados — antes de preguntar por el respaldo (ver
 * `PhotoUploadQueue.enqueue`). Mismo patrón/singleton que `ConfirmDialog`. */
export function SegmentPickerDialog() {
  const request = useSegmentPickerStore((s) => s.request)
  const settle = useSegmentPickerStore((s) => s.settle)

  if (!request) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={() => settle(null)} />
      <div role="alertdialog" aria-modal="true" className="relative z-10 w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-foreground shadow-2xl animate-confirm-in">
        <h2 className="text-base font-bold">{request.title ?? '¿A qué horario pertenecen estas fotos?'}</h2>
        <p className="mt-1 text-xs text-muted-foreground">Elige el rango declarado al que se asignarán todas las fotos que acabas de seleccionar.</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {request.segments.map((seg) => (
            <button
              key={seg.start}
              onClick={() => settle(seg)}
              className="rounded-full border border-border px-2 py-1.5 text-center text-xs font-semibold transition-colors hover:border-foreground hover:text-foreground"
            >
              {seg.start}–{seg.end}
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={() => settle(null)}
            className="rounded-full px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    getPortalRoot(),
  )
}
