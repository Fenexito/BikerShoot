import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getPortalRoot } from '../../../ui/shared/portalRoot'
import { useScrollLock } from '../../../ui/shared/useScrollLock'
import { DarkMultiSelectField } from '../../../ui/shared/DarkMultiSelectField'
import { IconClose } from '../../../ui/shared/icons'
import type { DarkSelectOption } from '../../../ui/shared/DarkSelectField'

export interface SearchFilterDraft {
  categories: string[]
  routeIds: string[]
  pointIds: string[]
  photographerIds: string[]
  horaDesde: string
  horaHasta: string
}

interface SearchFilterModalProps {
  open: boolean
  onClose: () => void
  categoryOptions: DarkSelectOption[]
  routeOptions: DarkSelectOption[]
  pointOptions: DarkSelectOption[]
  photographerOptions: DarkSelectOption[]
  value: SearchFilterDraft
  onApply: (next: SearchFilterDraft) => void
  /** Cuenta resultados que darían las selecciones actuales del borrador —
   * SIN aplicarlas todavía (ver nota sobre el bug de "tiempo real" abajo). */
  countFor: (draft: SearchFilterDraft) => number
}

const EMPTY_DRAFT: SearchFilterDraft = { categories: [], routeIds: [], pointIds: [], photographerIds: [], horaDesde: '', horaHasta: '' }

/** Antes este modal aplicaba cada cambio al instante (cada click reescribía
 * la URL y volvía a filtrar la búsqueda en vivo, con el modal todavía
 * abierto) — se sentía errático con selects múltiples, porque cada click en
 * una opción de checklist disparaba de inmediato un refiltrado completo de
 * la página de atrás. Ahora el modal tiene su propio "borrador" (`draft`,
 * inicializado desde `value` al abrir) y solo escribe hacia afuera cuando el
 * usuario presiona "Aplicar filtros" — el conteo de resultados en el botón
 * SÍ se recalcula en vivo contra ese borrador (vía `countFor`, puramente de
 * lectura) para que el usuario vea el efecto antes de comprometerse. */
export function SearchFilterModal({
  open,
  onClose,
  categoryOptions,
  routeOptions,
  pointOptions,
  photographerOptions,
  value,
  onApply,
  countFor,
}: SearchFilterModalProps) {
  const [draft, setDraft] = useState<SearchFilterDraft>(value)

  useEffect(() => {
    if (open) setDraft(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useScrollLock(open)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  // Ruta y Punto solo tienen sentido si la categoría elegida incluye "Rodada"
  // (o si no se eligió ninguna categoría todavía, en cuyo caso todo aplica) —
  // ver la nota de `EventsFilterModal` para el mismo criterio en Eventos.
  const routesApply = draft.categories.length === 0 || draft.categories.includes('Rodada')

  function update<K extends keyof SearchFilterDraft>(key: K, next: SearchFilterDraft[K]) {
    setDraft((d) => {
      const merged = { ...d, [key]: next }
      // Cambiar la categoría a algo que ya no incluya Rodada limpia ruta/punto
      // (dejarlos "aplicados por debajo" sin poder verse ni editarse sería
      // confuso). Cambiar la ruta reduce los puntos ya elegidos a los que
      // sigan perteneciendo a alguna ruta seleccionada.
      if (key === 'categories' && !(next as string[]).includes('Rodada') && (next as string[]).length > 0) {
        merged.routeIds = []
        merged.pointIds = []
      }
      return merged
    })
  }

  const resultCount = countFor(draft)
  const activeCount =
    draft.categories.length + draft.routeIds.length + draft.pointIds.length + draft.photographerIds.length + (draft.horaDesde || draft.horaHasta ? 1 : 0)

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto p-4 pt-16 sm:pt-24">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl animate-menu-in rounded-3xl border border-white/10 bg-neutral-900 p-6 text-white shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">Filtros de búsqueda</h2>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-5 text-xs text-white/50">
          Todos los filtros son opcionales y admiten varias selecciones a la vez — combínalos como quieras.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <DarkMultiSelectField label="Categoría" values={draft.categories} onChange={(v) => update('categories', v)} options={categoryOptions} />
          <DarkMultiSelectField
            label="Ruta"
            values={draft.routeIds}
            onChange={(v) => update('routeIds', v)}
            options={routeOptions}
            disabled={!routesApply}
            disabledHint="Solo aplica si la categoría incluye Rodada"
          />
          <DarkMultiSelectField
            label="Punto de cobertura"
            values={draft.pointIds}
            onChange={(v) => update('pointIds', v)}
            options={pointOptions}
            disabled={!routesApply}
            disabledHint="Solo aplica si la categoría incluye Rodada"
          />
          <DarkMultiSelectField label="Fotógrafo" values={draft.photographerIds} onChange={(v) => update('photographerIds', v)} options={photographerOptions} />
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Horario en el punto</span>
          <div className="flex items-center gap-3">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[11px] text-white/40">Desde</span>
              <input
                type="time"
                value={draft.horaDesde}
                onChange={(e) => update('horaDesde', e.target.value)}
                className="h-11 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-white/30 [color-scheme:dark]"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[11px] text-white/40">Hasta</span>
              <input
                type="time"
                value={draft.horaHasta}
                onChange={(e) => update('horaHasta', e.target.value)}
                className="h-11 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-white/30 [color-scheme:dark]"
              />
            </label>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          {activeCount > 0 && (
            <button
              onClick={() => setDraft(EMPTY_DRAFT)}
              className="flex shrink-0 items-center justify-center rounded-full bg-white/10 px-5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/20"
            >
              Borrar filtros
            </button>
          )}
          <button
            onClick={() => {
              onApply(draft)
              onClose()
            }}
            className="flex flex-1 items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            Aplicar filtros · Ver {resultCount} {resultCount === 1 ? 'foto' : 'fotos'}
          </button>
        </div>
      </div>
    </div>,
    getPortalRoot(),
  )
}
