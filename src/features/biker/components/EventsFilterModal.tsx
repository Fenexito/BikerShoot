import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getPortalRoot } from '../../../ui/shared/portalRoot'
import { DarkSelectField, type DarkSelectOption } from '../../../ui/shared/DarkSelectField'
import { IconClose } from '../../../ui/shared/icons'
import { cn } from '../../../lib/cn'

const SORTS: DarkSelectOption[] = [
  { value: 'recientes', label: 'Más recientes' },
  { value: 'proximos', label: 'Próximamente' },
]

interface EventsFilterModalProps {
  open: boolean
  onClose: () => void
  group: string
  onGroupChange: (v: string) => void
  routeOptions: DarkSelectOption[]
  categoryOptions: DarkSelectOption[]
  routeId: string
  onRouteChange: (v: string | undefined) => void
  category: string
  pointOptions: DarkSelectOption[]
  pointId: string
  cityOptions: DarkSelectOption[]
  photographerOptions: DarkSelectOption[]
  city: string
  photographerId: string
  timePresetOptions: DarkSelectOption[]
  hora: string
  sort: string
  onChange: (key: 'ciudad' | 'fotografo' | 'categoria' | 'punto' | 'hora' | 'orden', value: string | undefined) => void
  resultCount: number
}

/** Modal de filtros de Eventos — TODOS los filtros viven aquí (además de
 * la pastilla+tabs que ya están siempre visibles en la página/header, que
 * este modal también refleja/permite cambiar): tipo, ruta o categoría,
 * punto de cobertura, ciudad, fotógrafo, hora y orden. Todos opcionales y
 * funcionan en conjunto (se combinan con Y, no se excluyen entre sí).
 * Mismo ancho que `BikerSearchModal` (max-w-2xl) — mismo lenguaje visual
 * que `SearchFilterModal.tsx`. */
export function EventsFilterModal({
  open,
  onClose,
  group,
  onGroupChange,
  routeOptions,
  categoryOptions,
  routeId,
  onRouteChange,
  category,
  pointOptions,
  pointId,
  cityOptions,
  photographerOptions,
  city,
  photographerId,
  timePresetOptions,
  hora,
  sort,
  onChange,
  resultCount,
}: EventsFilterModalProps) {
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
      <div className="relative z-10 w-full max-w-2xl animate-menu-in rounded-3xl border border-white/10 bg-neutral-900 p-6 text-white shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">Filtros</h2>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Tipo</span>
          <div className="flex gap-2">
            {[{ value: 'rodada', label: 'Rodada' }, { value: 'evento', label: 'Evento' }].map((g) => (
              <button
                key={g.value}
                onClick={() => onGroupChange(g.value)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                  group === g.value ? 'bg-white text-black' : 'bg-white/10 text-white/80 hover:bg-white/20',
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {group === 'rodada' ? (
            <>
              <DarkSelectField label="Ruta" value={routeId} onChange={(v) => onRouteChange(v || undefined)} options={routeOptions} placeholder="Todas las rutas" />
              <DarkSelectField
                label="Punto de cobertura"
                value={pointId}
                onChange={(v) => onChange('punto', v || undefined)}
                options={pointOptions}
                placeholder={routeId ? 'Todos los puntos' : 'Elige una ruta primero'}
              />
            </>
          ) : (
            <DarkSelectField label="Categoría" value={category} onChange={(v) => onChange('categoria', v || undefined)} options={categoryOptions} placeholder="Todas" />
          )}
          <DarkSelectField label="Ciudad" value={city} onChange={(v) => onChange('ciudad', v || undefined)} options={cityOptions} />
          <DarkSelectField label="Fotógrafo" value={photographerId} onChange={(v) => onChange('fotografo', v || undefined)} options={photographerOptions} />
          <DarkSelectField label="Hora" value={hora} onChange={(v) => onChange('hora', v || undefined)} options={timePresetOptions.filter((t) => t.value)} placeholder="Cualquier hora" />
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
