import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getPortalRoot } from '../../../ui/shared/portalRoot'
import { IconClose } from '../../../ui/shared/icons'

interface FilterOption {
  value: string
  label: string
}

interface FilterFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  options: FilterOption[]
  placeholder?: string
}

function FilterField({ label, value, onChange, options, placeholder = 'Todas' }: FilterFieldProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/50">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition-colors focus:border-white/30"
      >
        <option value="" className="text-black">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="text-black">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

interface SearchFilterModalProps {
  open: boolean
  onClose: () => void
  routeOptions: FilterOption[]
  cityOptions: FilterOption[]
  categoryOptions: FilterOption[]
  brandOptions: FilterOption[]
  routeId: string
  city: string
  category: string
  motoBrand: string
  onlyMyBrand: boolean
  myBrand?: string
  sort: string
  onChange: (key: string, value: string | undefined) => void
  resultCount: number
}

export function SearchFilterModal({
  open,
  onClose,
  routeOptions,
  cityOptions,
  categoryOptions,
  brandOptions,
  routeId,
  city,
  category,
  motoBrand,
  onlyMyBrand,
  myBrand,
  sort,
  onChange,
  resultCount,
}: SearchFilterModalProps) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

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

        <div className="grid gap-5 sm:grid-cols-2">
          <FilterField label="Ruta" value={routeId} onChange={(v) => onChange('ruta', v || undefined)} options={routeOptions} />
          <FilterField label="Ciudad" value={city} onChange={(v) => onChange('ciudad', v || undefined)} options={cityOptions} />
          <FilterField label="Categoría" value={category} onChange={(v) => onChange('categoria', v || undefined)} options={categoryOptions} />
          <FilterField
            label="Marca de moto"
            value={motoBrand}
            onChange={(v) => onChange('marca', v || undefined)}
            options={brandOptions}
            placeholder={onlyMyBrand ? myBrand ?? 'Todas' : 'Todas'}
          />
        </div>

        {myBrand && (
          <label className="mt-5 flex items-center gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={onlyMyBrand}
              onChange={(e) => onChange('mi_moto', e.target.checked ? '1' : undefined)}
              className="h-4 w-4 accent-white"
            />
            Solo mi moto ({myBrand})
          </label>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Ordenar por</span>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'relevancia', label: 'Relevancia' },
              { value: 'precio-asc', label: 'Precio: menor a mayor' },
              { value: 'precio-desc', label: 'Precio: mayor a menor' },
            ].map((o) => (
              <button
                key={o.value}
                onClick={() => onChange('orden', o.value)}
                className={
                  sort === o.value
                    ? 'rounded-full bg-white px-4 py-2 text-sm font-semibold text-black'
                    : 'rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/20'
                }
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-8 flex w-full items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          Ver {resultCount} {resultCount === 1 ? 'foto' : 'fotos'}
        </button>
      </div>
    </div>,
    getPortalRoot(),
  )
}
