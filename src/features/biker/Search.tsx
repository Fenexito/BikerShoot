import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePublicEvents, useApprovedPhotographers, useSearchPhotos } from './usePublicData'
import { useRoutes } from '../shared/useRoutes'
import { PhotoGrid, type GridPhoto } from './components/PhotoGrid'
import { PhotoLightbox } from './components/PhotoLightbox'
import { SearchFilterModal, type SearchFilterDraft } from './components/SearchFilterModal'
import { Badge } from '../../ui/flat/Badge'
import { IconFilter, IconSearch, IconGridSmall, IconGridLarge, IconClose } from '../../ui/shared/icons'
import { ScrollToTopButton } from '../../ui/shared/ScrollToTopButton'
import { useHeaderTransform } from '../../ui/layout/useHeaderTransform'
import { useScrolledPast } from '../../ui/shared/useScrolledPast'
import { cn } from '../../lib/cn'

// Rango del resizer de tamaño de foto — el tope (270px) está calculado
// para que, incluso en el tamaño MÁS GRANDE posible, sigan cabiendo al
// menos 6 fotos por fila en el ancho máximo del contenedor: 1800px menos
// padding (md:px-8 = 32px por lado) = 1736px disponibles; con gap-3
// (12px) entre columnas, 6 fotos de 270px + 5 gaps = 1680+60 = 1740px…
// ligeramente ajustado a 270 (no 279, el límite matemático exacto) para
// dejar margen a la barra de scroll del navegador, que resta ancho real
// sin que el cálculo de CSS lo sepa. El piso (130px) da bastantes más
// por fila para quien prefiera una vista densa tipo contact-sheet.
const TILE_SIZE_MIN = 130
const TILE_SIZE_MAX = 270
const TILE_SIZE_DEFAULT = 220
const TILE_SIZE_KEY = 'motoshots_biker_photo_tile_size'

function loadTileSize() {
  try {
    const raw = localStorage.getItem(TILE_SIZE_KEY)
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) && n >= TILE_SIZE_MIN && n <= TILE_SIZE_MAX ? n : TILE_SIZE_DEFAULT
  } catch {
    return TILE_SIZE_DEFAULT
  }
}

function writeList(next: URLSearchParams, key: string, values: string[]) {
  if (values.length > 0) next.set(key, values.join(','))
  else next.delete(key)
}

export function Search() {
  const { data: events = [] } = usePublicEvents()
  const { data: photographers = [] } = useApprovedPhotographers()
  const { data: routes = [] } = useRoutes()
  const [searchParams, setSearchParams] = useSearchParams()
  const [lightbox, setLightbox] = useState<{ photos: GridPhoto[]; index: number } | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Histéresis (activa a 140px, desactiva a 60px): el hero colapsado abajo
  // encoge la página varios cientos de píxeles, y sin este margen el cambio
  // de layout podía empujar el scroll justo por debajo del umbral en el
  // mismo instante en que se cruzaba, atascando el header en un ciclo de
  // animación entrada/salida sin fin.
  const scrolled = useScrolledPast(140, 60)
  const [tileSize, setTileSize] = useState(TILE_SIZE_DEFAULT)

  useEffect(() => {
    setTileSize(loadTileSize())
  }, [])

  function changeTileSize(next: number) {
    setTileSize(next)
    try {
      localStorage.setItem(TILE_SIZE_KEY, String(next))
    } catch {
      // localStorage puede fallar (modo privado, cuota llena) — el tamaño
      // elegido simplemente no se recuerda la próxima vez, no es grave.
    }
  }

  const query = searchParams.get('q') ?? ''
  const eventId = searchParams.get('evento') ?? ''
  const categoriasParam = searchParams.get('categorias') ?? ''
  const rutasParam = searchParams.get('rutas') ?? ''
  const puntosParam = searchParams.get('puntos') ?? ''
  const fotografosParam = searchParams.get('fotografos') ?? ''
  const horaDesde = searchParams.get('hora_desde') ?? ''
  const horaHasta = searchParams.get('hora_hasta') ?? ''
  // Memoizados sobre el string crudo (no sobre `searchParams` en sí, que es
  // un objeto nuevo en cada render) para que los useMemo encadenados más
  // abajo (opciones de ruta/punto/fotógrafo, todas derivadas de estas
  // listas) tengan una dependencia realmente estable entre renders.
  const categories = useMemo(() => (categoriasParam ? categoriasParam.split(',').filter(Boolean) : []), [categoriasParam])
  const routeIds = useMemo(() => (rutasParam ? rutasParam.split(',').filter(Boolean) : []), [rutasParam])
  const pointIds = useMemo(() => (puntosParam ? puntosParam.split(',').filter(Boolean) : []), [puntosParam])
  const photographerIds = useMemo(() => (fotografosParam ? fotografosParam.split(',').filter(Boolean) : []), [fotografosParam])

  function setQuery(value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set('q', value)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  function applyFilters(draft: SearchFilterDraft) {
    const next = new URLSearchParams(searchParams)
    writeList(next, 'categorias', draft.categories)
    writeList(next, 'rutas', draft.routeIds)
    writeList(next, 'puntos', draft.pointIds)
    writeList(next, 'fotografos', draft.photographerIds)
    if (draft.horaDesde) next.set('hora_desde', draft.horaDesde)
    else next.delete('hora_desde')
    if (draft.horaHasta) next.set('hora_hasta', draft.horaHasta)
    else next.delete('hora_hasta')
    setSearchParams(next, { replace: true })
  }

  function clearFilter(key: string) {
    const next = new URLSearchParams(searchParams)
    next.delete(key)
    setSearchParams(next, { replace: true })
  }

  function clearAllFilters() {
    const next = new URLSearchParams()
    if (query) next.set('q', query)
    setSearchParams(next, { replace: true })
  }

  const { data: rawResults = [], isLoading: resultsLoading } = useSearchPhotos({
    query: query || undefined,
    eventId: eventId || undefined,
    categories: categories.length ? categories : undefined,
    routeIds: routeIds.length ? routeIds : undefined,
    pointIds: pointIds.length ? pointIds : undefined,
    photographerIds: photographerIds.length ? photographerIds : undefined,
    horaDesde: horaDesde || undefined,
    horaHasta: horaHasta || undefined,
  })

  const results: GridPhoto[] = useMemo(
    () =>
      rawResults.map((p) => ({
        ...p,
        eventTitle: p.event?.title ?? '',
        photographerName: p.photographer?.display_name ?? '',
        pointLabel: p.point?.label,
      })),
    [rawResults],
  )

  // Opciones de cada filtro DEPENDEN de las anteriores (item 6: "que solo
  // aparezcan opciones disponibles si coinciden con los filtros padres" para
  // no sobrepoblar el modal) — se recalculan sobre `events`, no sobre
  // `rawResults`, porque una foto ya filtrada por categoría no debería poder
  // "resucitar" una ruta que ya quedó descartada.
  const eventsMatchingCategory = useMemo(
    () => (categories.length ? events.filter((e) => categories.includes(e.category)) : events),
    [events, categories],
  )
  const routeOptions = useMemo(() => routes.map((r) => ({ value: r.id, label: r.name })), [routes])
  const eventsMatchingRoute = useMemo(
    () =>
      routeIds.length
        ? eventsMatchingCategory.filter((e) => e.event_points.some((pt) => pt.route_point && routeIds.includes(pt.route_point.route_id)))
        : eventsMatchingCategory,
    [eventsMatchingCategory, routeIds],
  )
  const pointOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const e of eventsMatchingRoute) {
      for (const pt of e.event_points) {
        if (routeIds.length && !(pt.route_point && routeIds.includes(pt.route_point.route_id))) continue
        seen.set(pt.id, `${pt.label} · ${e.title}`)
      }
    }
    return Array.from(seen, ([value, label]) => ({ value, label }))
  }, [eventsMatchingRoute, routeIds])
  const eventsMatchingPoint = useMemo(
    () => (pointIds.length ? eventsMatchingRoute.filter((e) => e.event_points.some((pt) => pointIds.includes(pt.id))) : eventsMatchingRoute),
    [eventsMatchingRoute, pointIds],
  )
  const photographerOptions = useMemo(() => {
    const ids = new Set(eventsMatchingPoint.map((e) => e.photographer_id))
    return photographers.filter((p) => ids.has(p.id)).map((p) => ({ value: p.id, label: p.display_name }))
  }, [eventsMatchingPoint, photographers])
  const categoryOptions = useMemo(() => Array.from(new Set(events.map((e) => e.category))).map((c) => ({ value: c, label: c })), [events])

  function countFor(draft: SearchFilterDraft) {
    return rawResults.filter((p) => {
      if (draft.categories.length && !draft.categories.includes(p.event?.category ?? '')) return false
      if (draft.routeIds.length && !(p.point?.route_point?.route_id && draft.routeIds.includes(p.point.route_point.route_id))) return false
      if (draft.pointIds.length && !(p.point_id && draft.pointIds.includes(p.point_id))) return false
      if (draft.photographerIds.length && !draft.photographerIds.includes(p.photographer_id)) return false
      return true
    }).length
  }

  const activeChips = [
    query && { key: 'q', label: `"${query}"` },
    ...categories.map((c) => ({ key: 'categorias', label: c, remove: () => clearFilter('categorias') })),
    ...routeIds.map((id) => ({ key: `ruta-${id}`, label: routes.find((r) => r.id === id)?.name ?? 'Ruta', remove: () => setSearchParams((p) => { const n = new URLSearchParams(p); writeList(n, 'rutas', routeIds.filter((v) => v !== id)); return n }, { replace: true }) })),
    ...pointIds.map((id) => ({
      key: `punto-${id}`,
      label: pointOptions.find((o) => o.value === id)?.label ?? 'Punto',
      remove: () => setSearchParams((p) => { const n = new URLSearchParams(p); writeList(n, 'puntos', pointIds.filter((v) => v !== id)); return n }, { replace: true }),
    })),
    ...photographerIds.map((id) => ({
      key: `foto-${id}`,
      label: photographers.find((p) => p.id === id)?.display_name ?? 'Fotógrafo',
      remove: () => setSearchParams((p) => { const n = new URLSearchParams(p); writeList(n, 'fotografos', photographerIds.filter((v) => v !== id)); return n }, { replace: true }),
    })),
    (horaDesde || horaHasta) && { key: 'hora', label: `${horaDesde || '…'} - ${horaHasta || '…'}`, remove: () => { clearFilter('hora_desde'); clearFilter('hora_hasta') } },
  ].filter(Boolean) as { key: string; label: string; remove?: () => void }[]

  const activeFilterCount = categories.length + routeIds.length + pointIds.length + photographerIds.length + (horaDesde || horaHasta ? 1 : 0)

  // El header (HeaderUser) se transforma al pasar el umbral de scroll: en
  // vez del nav+buscador genérico, muestra el buscador propio de esta
  // página + el botón de Filtros (con una "x limpiar" rápida si ya hay
  // filtros aplicados) — reemplaza la barra flotante que antes vivía aparte,
  // pegada justo debajo del header. `hideSearchTrigger` evita que HeaderUser
  // agregue SU propio botón "Buscar…" al lado — esta página ya trae uno.
  useHeaderTransform(
    <div className="flex w-full items-center gap-2">
      <div className="flex flex-1 items-center gap-2 rounded-full bg-muted px-4">
        <IconSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Evento, ciudad, fotógrafo…"
          className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <button
        onClick={() => setFiltersOpen(true)}
        className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold shadow-sm transition-colors hover:bg-muted"
      >
        <IconFilter className="h-4 w-4" />
        Filtros
        {activeFilterCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
            {activeFilterCount}
          </span>
        )}
      </button>
      {activeFilterCount > 0 && (
        <button
          onClick={clearAllFilters}
          aria-label="Limpiar filtros"
          title="Limpiar filtros"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
        >
          <IconClose className="h-4 w-4" />
        </button>
      )}
    </div>,
    scrolled,
    true,
  )

  return (
    <div className="font-flat">
      {/* Hero simplificado: antes tenía, además del buscador, una fila de
          botones de categoría (Rodada/Pista/Sesión) que duplicaba el nuevo
          filtro multi-selectivo de categoría del modal — con hasta 40
          fotógrafos, 100+ eventos/mes y ~500,000 fotos por filtrar, la
          categoría es solo UNO de varios filtros que se combinan entre sí
          (ruta, punto, fotógrafo, horario), así que vive mejor dentro del
          modal de Filtros que como botones sueltos aquí arriba. */}
      <div
        className={cn(
          'overflow-hidden px-4 text-center transition-all duration-300 md:px-8',
          scrolled ? 'max-h-0 py-0 opacity-0' : 'max-h-96 py-14 opacity-100',
        )}
      >
        <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">Encuentra tus fotos en segundos.</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          Busca por evento, ciudad o fotógrafo — {results.length} fotos disponibles ahora mismo.
        </p>
        <div className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-full bg-muted px-5 shadow-sm">
          <IconSearch className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Evento, ciudad, fotógrafo…"
            className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={() => setFiltersOpen(true)}
            className="flex shrink-0 items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
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
      </div>

      <div className="mx-auto max-w-[1800px] px-4 pb-8 pt-6 md:px-8">
        <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{results.length}</span> fotos encontradas
          </p>
        </div>

        {/* Contador + resizer de tamaño de foto — solo desde md:, en móvil
            no hay espacio real para aprovechar el control de densidad y el
            grid ya usa el mínimo de columnas cómodo por defecto. */}
        <div className="mb-4 hidden items-center justify-between gap-3 md:flex">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{results.length}</span> fotos encontradas
          </p>
          <div className="flex items-center gap-3">
            <IconGridSmall className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="range"
              min={TILE_SIZE_MIN}
              max={TILE_SIZE_MAX}
              step={10}
              value={tileSize}
              onChange={(e) => changeTileSize(Number(e.target.value))}
              aria-label="Tamaño de las fotos"
              className="h-1.5 w-32 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />
            <IconGridLarge className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {activeChips.map((chip) => (
              <button key={chip.key} onClick={() => (chip.remove ? chip.remove() : clearFilter(chip.key))}>
                <Badge tone="secondary" className="cursor-pointer gap-1 hover:bg-emerald-200">
                  {chip.label} ✕
                </Badge>
              </button>
            ))}
            <button onClick={clearAllFilters} className="text-sm font-medium text-muted-foreground underline">
              Limpiar todo
            </button>
          </div>
        )}

        {/* `key` fuerza a PhotoGrid a re-montar (y así re-disparar la
            animación de entrada de sus primeras fotos) cada vez que cambia
            el conjunto de filtros aplicados — sin esto, cambiar de filtro
            solo reordenaba/recortaba el mismo grid sin dar ninguna señal
            visual de "esto se acaba de refiltrar". */}
        <PhotoGrid
          key={`${categories.join(',')}|${routeIds.join(',')}|${pointIds.join(',')}|${photographerIds.join(',')}|${horaDesde}|${horaHasta}|${query}`}
          photos={results}
          isLoading={resultsLoading}
          tileSize={tileSize}
          onOpenPhoto={(photos, index) => setLightbox({ photos, index })}
        />
      </div>

      <SearchFilterModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        categoryOptions={categoryOptions}
        routeOptions={routeOptions}
        pointOptions={pointOptions}
        photographerOptions={photographerOptions}
        value={{ categories, routeIds, pointIds, photographerIds, horaDesde, horaHasta }}
        onApply={applyFilters}
        countFor={countFor}
      />

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(index) => setLightbox({ photos: lightbox.photos, index })}
        />
      )}

      <ScrollToTopButton />
    </div>
  )
}
