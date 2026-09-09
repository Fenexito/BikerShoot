import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getPortalRoot } from '../../../ui/shared/portalRoot'
import { DarkSelectField, type DarkSelectOption } from '../../../ui/shared/DarkSelectField'
import { IconClose } from '../../../ui/shared/icons'

const SORTS: DarkSelectOption[] = [
  { value: 'recientes', label: 'Más recientes' },
  { value: 'proximos', label: 'Próximamente' },
]

interface EventsFilterModalProps {
  open: boolean
  onClose: () => void
  cityOptions: DarkSelectOption[]
  photographerOptions: DarkSelectOption[]
  city: string
  photographerId: string
  sort: string
  onChange: (key: 'ciudad' | 'fotografo' | 'orden', value: string | undefined) => void
  resultCount: number
}

/** Modal de filtros secundarios de Eventos — ciudad, fotógrafo y orden.
 * Antes vivían como controles sueltos siempre visibles en la página; se
 * movieron aquí (detrás de un botón "Filtros") para dejar espacio a la
 * pastilla Rodada/Evento + sus tabs dinámicas, que son el filtro principal
 * ahora. Mismo lenguaje visual que `SearchFilterModal.tsx`. */
export function EventsFilterModal({ open, onClose, cityOptions, photographerOptions, city, photographerId, sort, onChange, resultCount }: EventsFilterModalProps) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto p-4 pt-16 sm:pt-24">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg animate-menu-in rounded-3xl border border-white/10 bg-neutral-900 p-6 text-white shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">Filtros</h2>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <DarkSelectField label="Ciudad" value={city} onChange={(v) => onChange('ciudad', v || undefined)} options={cityOptions} />
          <DarkSelectField label="Fotógrafo" value={photographerId} onChange={(v) => onChange('fotografo', v || undefined)} options={photographerOptions} />
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Ordenar por</span>
          <div className="flex flex-wrap gap-2">
            {SORTS.map((s) => (
              <button
                key={s.value}
                onClick={() => onChange('orden', s.value === 'recientes' ? undefined : s.value)}
                className={
                  (sort || 'recientes') === s.value
                    ? 'rounded-full bg-white px-4 py-2 text-sm font-semibold text-black'
                    : 'rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/20'
                }
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-8 flex w-full items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          Ver {resultCount} {resultCount === 1 ? 'evento' : 'eventos'}
        </button>
      </div>
    </div>,
    getPortalRoot(),
  )
}
