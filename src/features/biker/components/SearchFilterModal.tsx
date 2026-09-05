import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getPortalRoot } from '../../../ui/shared/portalRoot'
import { IconClose } from '../../../ui/shared/icons'
import { cn } from '../../../lib/cn'

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

/** Mismo panel oscuro flotante que ProfileMenu/Dropdown — este modal ya vive
 * sobre un fondo oscuro, así que el trigger se ve como un campo translúcido
 * en vez del <select> gris nativo. */
function FilterField({ label, value, onChange, options, placeholder = 'Todas' }: FilterFieldProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const current = options.find((o) => o.value === value)

  return (
    <div ref={rootRef} className="relative flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/50">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 items-center justify-between gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-left text-sm text-white outline-none transition-colors focus:border-white/30"
      >
        <span className={cn('truncate', !current && 'text-white/50')}>{current?.label ?? placeholder}</span>
        <span className={cn('shrink-0 text-[10px] text-white/50 transition-transform', open && 'rotate-180')}>▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-60 w-full min-w-[10rem] origin-top animate-menu-in overflow-y-auto rounded-2xl border border-white/10 bg-neutral-800 py-1.5 shadow-2xl">
          <button
            type="button"
            onClick={() => { setOpen(false); onChange('') }}
            className={cn('block w-full truncate px-4 py-2 text-left text-sm font-medium transition-colors hover:bg-white/10', !value ? 'text-white' : 'text-white/70')}
          >
            {placeholder}
          </button>
          {options.map((o) => (
            <button
              type="button"
              key={o.value}
              onClick={() => { setOpen(false); onChange(o.value) }}
              className={cn('block w-full truncate px-4 py-2 text-left text-sm font-medium transition-colors hover:bg-white/10', value === o.value ? 'text-white' : 'text-white/70')}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
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
