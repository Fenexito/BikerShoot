import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useBikerDetails } from './useBikerDetails'
import { events, photographers, searchPhotos, type Photo, type SearchFilters } from '../../data/mockPhotos'
import { PhotoGrid } from './components/PhotoGrid'
import { PhotoLightbox } from './components/PhotoLightbox'
import { Select } from '../../ui/flat/Select'
import { Badge } from '../../ui/flat/Badge'

const CITIES = Array.from(new Set(events.map((e) => e.city)))
const MOTO_BRANDS = Array.from(new Set([...events.map(() => ''), 'Yamaha', 'Honda', 'Kawasaki', 'Suzuki', 'KTM', 'BMW', 'Ducati'])).filter(Boolean)
const CATEGORIES = Array.from(new Set(events.map((e) => e.category)))

export function Search() {
  const { user } = useAuth()
  const { data: bikerDetails } = useBikerDetails(user?.id)
  const [searchParams, setSearchParams] = useSearchParams()
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number } | null>(null)

  const query = searchParams.get('q') ?? ''
  const city = searchParams.get('ciudad') ?? ''
  const category = (searchParams.get('categoria') as SearchFilters['category']) ?? undefined
  const motoBrand = searchParams.get('marca') ?? ''
  const photographerId = searchParams.get('fotografo') ?? ''
  const sort = (searchParams.get('orden') as SearchFilters['sort']) ?? 'relevancia'
  const onlyMyBrand = searchParams.get('mi_moto') === '1'

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const effectiveBrand = onlyMyBrand ? bikerDetails?.moto_brand ?? '' : motoBrand

  const results = useMemo(
    () =>
      searchPhotos({
        query: query || undefined,
        city: city || undefined,
        category,
        motoBrand: effectiveBrand || undefined,
        photographerId: photographerId || undefined,
        sort,
      }),
    [query, city, category, effectiveBrand, photographerId, sort],
  )

  const activeChips = [
    query && { key: 'q', label: `"${query}"` },
    city && { key: 'ciudad', label: city },
    category && { key: 'categoria', label: category },
    motoBrand && !onlyMyBrand && { key: 'marca', label: motoBrand },
    onlyMyBrand && bikerDetails?.moto_brand && { key: 'mi_moto', label: `Mi moto: ${bikerDetails.moto_brand}` },
    photographerId && { key: 'fotografo', label: photographers.find((p) => p.id === photographerId)?.name ?? '' },
  ].filter(Boolean) as { key: string; label: string }[]

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 font-flat md:px-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">Buscar fotos</h1>
      <p className="mb-6 text-muted-foreground">{results.length} fotos encontradas</p>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Filtros avanzados */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
          <input
            value={query}
            onChange={(e) => setParam('q', e.target.value || undefined)}
            placeholder="Evento, ciudad, fotógrafo..."
            className="h-12 rounded-md border-2 border-transparent bg-muted px-4 text-sm outline-none transition-colors duration-200 focus:border-primary focus:bg-background"
          />

          <Select label="Ciudad" value={city} onChange={(e) => setParam('ciudad', e.target.value || undefined)}>
            <option value="">Todas</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>

          <Select label="Categoría" value={category ?? ''} onChange={(e) => setParam('categoria', e.target.value || undefined)}>
            <option value="">Todas</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>

          <Select
            label="Marca de moto"
            value={motoBrand}
            disabled={onlyMyBrand}
            onChange={(e) => setParam('marca', e.target.value || undefined)}
          >
            <option value="">Todas</option>
            {MOTO_BRANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </Select>

          {bikerDetails?.moto_brand && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyMyBrand}
                onChange={(e) => setParam('mi_moto', e.target.checked ? '1' : undefined)}
                className="h-4 w-4 accent-primary"
              />
              Solo mi moto ({bikerDetails.moto_brand})
            </label>
          )}

          <Select label="Ordenar por" value={sort} onChange={(e) => setParam('orden', e.target.value)}>
            <option value="relevancia">Relevancia</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
          </Select>
        </aside>

        {/* Resultados */}
        <div>
          {activeChips.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {activeChips.map((chip) => (
                <button key={chip.key} onClick={() => setParam(chip.key, undefined)}>
                  <Badge tone="secondary" className="cursor-pointer gap-1 hover:bg-emerald-200">
                    {chip.label} ✕
                  </Badge>
                </button>
              ))}
              <button
                onClick={() => setSearchParams({}, { replace: true })}
                className="text-sm font-medium text-muted-foreground underline"
              >
                Limpiar todo
              </button>
            </div>
          )}

          <PhotoGrid photos={results} onOpenPhoto={(photos, index) => setLightbox({ photos, index })} />
        </div>
      </div>

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(index) => setLightbox({ photos: lightbox.photos, index })}
        />
      )}
    </div>
  )
}
