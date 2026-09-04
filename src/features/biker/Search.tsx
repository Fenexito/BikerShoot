import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useBikerDetails } from './useBikerDetails'
import { usePublicEvents, useApprovedPhotographers, useSearchPhotos, type SearchFilters } from './usePublicData'
import { useRoutes } from '../shared/useRoutes'
import { PhotoGrid, type GridPhoto } from './components/PhotoGrid'
import { PhotoLightbox } from './components/PhotoLightbox'
import { SearchFilterModal } from './components/SearchFilterModal'
import { Badge } from '../../ui/flat/Badge'
import { IconFilter, IconSearch } from '../../ui/shared/icons'
import { cn } from '../../lib/cn'

const CATEGORIES = ['Rodada', 'Pista', 'Sesión de Fotos']

export function Search() {
  const { user } = useAuth()
  const { data: bikerDetails } = useBikerDetails(user?.id)
  const { data: events = [] } = usePublicEvents()
  const { data: photographers = [] } = useApprovedPhotographers()
  const { data: routes = [] } = useRoutes()
  const [searchParams, setSearchParams] = useSearchParams()
  const [lightbox, setLightbox] = useState<{ photos: GridPhoto[]; index: number } | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 140)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const query = searchParams.get('q') ?? ''
  const city = searchParams.get('ciudad') ?? ''
  const category = searchParams.get('categoria') ?? ''
  const motoBrand = searchParams.get('marca') ?? ''
  const photographerId = searchParams.get('fotografo') ?? ''
  const routeId = searchParams.get('ruta') ?? ''
  const sort = (searchParams.get('orden') as SearchFilters['sort']) ?? 'relevancia'
  const onlyMyBrand = searchParams.get('mi_moto') === '1'

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const effectiveBrand = onlyMyBrand ? bikerDetails?.moto_brand ?? '' : motoBrand

  const { data: rawResults = [] } = useSearchPhotos({
    query: query || undefined,
    city: city || undefined,
    category: category || undefined,
    motoBrand: effectiveBrand || undefined,
    photographerId: photographerId || undefined,
    routeId: routeId || undefined,
    sort,
  })

  const results: GridPhoto[] = useMemo(
    () =>
      rawResults.map((p) => ({
        ...p,
        eventTitle: p.event?.title ?? '',
        photographerName: p.photographer?.display_name ?? '',
      })),
    [rawResults],
  )

  const CITIES = useMemo(() => Array.from(new Set(events.map((e) => e.city))), [events])
  const MOTO_BRANDS = useMemo(
    () => Array.from(new Set(rawResults.map((p) => p.moto_brand).filter(Boolean))) as string[],
    [rawResults],
  )

  const activeChips = [
    query && { key: 'q', label: `"${query}"` },
    city && { key: 'ciudad', label: city },
    category && { key: 'categoria', label: category },
    motoBrand && !onlyMyBrand && { key: 'marca', label: motoBrand },
    onlyMyBrand && bikerDetails?.moto_brand && { key: 'mi_moto', label: `Mi moto: ${bikerDetails.moto_brand}` },
    photographerId && { key: 'fotografo', label: photographers.find((p) => p.id === photographerId)?.display_name ?? '' },
    routeId && { key: 'ruta', label: routes.find((r) => r.id === routeId)?.name ?? '' },
  ].filter(Boolean) as { key: string; label: string }[]

  const activeFilterCount = activeChips.length

  return (
    <div className="font-flat">
      {/* Hero — se colapsa al hacer scroll, como la referencia */}
      <div
        className={cn(
          'overflow-hidden px-4 text-center transition-all duration-300 md:px-8',
          scrolled ? 'max-h-0 py-0 opacity-0' : 'max-h-96 py-14 opacity-100',
        )}
      >
        <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">Encuentra tus fotos en segundos.</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          Busca por evento, ruta, ciudad o fotógrafo — {results.length} fotos disponibles ahora mismo.
        </p>
        <div className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-full bg-muted px-5 shadow-sm">
          <IconSearch className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setParam('q', e.target.value || undefined)}
            placeholder="Evento, ciudad, fotógrafo…"
            className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setParam('categoria', category === c ? undefined : c)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                category === c ? 'bg-primary text-white' : 'bg-muted text-foreground hover:bg-border',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Barra compacta — siempre visible, se pega debajo del header al hacer scroll */}
      <div
        className={cn(
          'sticky top-[4.5rem] z-20 mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 px-4 py-4 transition-colors md:top-20 md:px-8',
          scrolled && 'rounded-b-3xl bg-background/95 shadow-sm backdrop-blur-md',
        )}
      >
        <div>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{results.length}</span> fotos encontradas
          </p>
        </div>
        <button
          onClick={() => setFiltersOpen(true)}
          className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors hover:bg-muted"
        >
          <IconFilter className="h-4 w-4" />
          Filtros
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <div className="mx-auto max-w-[1800px] px-4 pb-8 md:px-8">
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

      <SearchFilterModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        routeOptions={routes.map((r) => ({ value: r.id, label: r.name }))}
        cityOptions={CITIES.map((c) => ({ value: c, label: c }))}
        categoryOptions={CATEGORIES.map((c) => ({ value: c, label: c }))}
        brandOptions={MOTO_BRANDS.map((b) => ({ value: b, label: b }))}
        routeId={routeId}
        city={city}
        category={category}
        motoBrand={motoBrand}
        onlyMyBrand={onlyMyBrand}
        myBrand={bikerDetails?.moto_brand ?? undefined}
        sort={sort}
        onChange={setParam}
        resultCount={results.length}
      />

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
