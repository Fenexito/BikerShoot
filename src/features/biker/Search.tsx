import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePublicEvents, useApprovedPhotographers, useSearchPhotos, type PublicEvent, type PublicEventPoint } from './usePublicData'
import { useRoutes } from '../shared/useRoutes'
import { PhotoGrid, type GridPhoto } from './components/PhotoGrid'
import { PhotoLightbox } from './components/PhotoLightbox'
import { Badge } from '../../ui/flat/Badge'
import { FilterDropdown, type FilterDropdownOption } from '../../ui/shared/FilterDropdown'
import { TimeRangeSlider } from '../../ui/shared/TimeRangeSlider'
import { IconSearch, IconGridSmall, IconGridLarge, IconClose } from '../../ui/shared/icons'
import { ScrollToTopButton } from '../../ui/shared/ScrollToTopButton'
import { useHeaderTransform } from '../../ui/layout/useHeaderTransform'
import { useScrolledPast } from '../../ui/shared/useScrolledPast'
import { cn } from '../../lib/cn'

// Rango del resizer de tamaño de foto — el tope (270px) está calculado
// para que, incluso en el tamaño MÁS GRANDE posible, sigan cabiendo al
// menos 6 fotos por fila en el ancho máximo del contenedor: 1800px menos
// padding (md:px-8 = 32px por lado) = 1736px disponibles; con gap-2
// (8px) entre columnas, 6 fotos de 270px + 5 gaps = 1620+40 = 1660px…
// el piso (130px) da ~12 por fila en ese mismo ancho.
const TILE_SIZE_MIN = 130
const TILE_SIZE_MAX = 270
const TILE_SIZE_DEFAULT = 220
// Pasos grandes a propósito: cada movimiento del control debe sentirse
// como un cambio de tamaño real, no un ajuste casi imperceptible.
const TILE_SIZE_STEP = 20
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
  if (values.length > 0) next.set(key, values.map(encodeURIComponent).join(','))
  else next.delete(key)
}

function readList(raw: string): string[] {
  return raw ? raw.split(',').filter(Boolean).map(decodeURIComponent) : []
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToHHMM(mins: number) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0')
  const m = Math.round(mins % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

interface FieldFilters {
  categories: string[]
  routeIds: string[]
  pointLabels: string[]
  photographerIds: string[]
}

/** Todos los pares evento+punto que cumplen los filtros elegidos — EXCEPTO
 * el campo `skip`, para poder calcular las opciones de ESE campo a partir de
 * los demás ("interconectados": elegir un fotógrafo limita categoría/ruta/
 * punto a lo que ese fotógrafo realmente tiene, y viceversa con cualquier
 * otro campo). Sin `skip`, aplica los cuatro filtros a la vez (usado para
 * calcular el rango de horario disponible). */
function matchingPoints(events: PublicEvent[], f: FieldFilters, skip?: keyof FieldFilters): { event: PublicEvent; point: PublicEventPoint }[] {
  const eff: FieldFilters = { ...f, ...(skip ? { [skip]: [] } : {}) }
  const pairs: { event: PublicEvent; point: PublicEventPoint }[] = []
  for (const e of events) {
    if (eff.categories.length && !eff.categories.includes(e.category)) continue
    if (eff.photographerIds.length && !eff.photographerIds.includes(e.photographer_id)) continue
    for (const pt of e.event_points) {
      if (eff.routeIds.length && !(pt.route_point && eff.routeIds.includes(pt.route_point.route_id))) continue
      if (eff.pointLabels.length && !eff.pointLabels.includes(pt.label)) continue
      pairs.push({ event: e, point: pt })
    }
  }
  return pairs
}

function dedupeOptions(values: string[]): FilterDropdownOption[] {
  return Array.from(new Set(values)).map((v) => ({ value: v, label: v }))
}

function HourRangeDropdown({ boundsMin, boundsMax, valueMin, valueMax, active, onChange }: {
  boundsMin: number
  boundsMax: number
  valueMin: number
  valueMax: number
  active: boolean
  onChange: (min: number, max: number) => void
}) {
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

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors',
          active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-foreground hover:bg-muted',
        )}
      >
        {active ? `${minutesToHHMM(valueMin)} - ${minutesToHHMM(valueMax)}` : 'Horario'}
        <span className={cn('shrink-0 text-[10px] transition-transform', open && 'rotate-180')}>▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 origin-top animate-menu-in rounded-2xl border border-border bg-background p-4 shadow-2xl">
          <TimeRangeSlider boundsMin={boundsMin} boundsMax={boundsMax} valueMin={valueMin} valueMax={valueMax} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

export function Search() {
  const { data: events = [] } = usePublicEvents()
  const { data: photographers = [] } = useApprovedPhotographers()
  const { data: routes = [] } = useRoutes()
  const [searchParams, setSearchParams] = useSearchParams()
  const [lightbox, setLightbox] = useState<{ photos: GridPhoto[]; index: number } | null>(null)
  // Umbral simple (sin histéresis): ya no hace falta — el hero dejó de
  // encogerse con el scroll (ver nota más abajo), así que no hay cambio de
  // layout que pueda empujar el scroll de un lado al otro del umbral.
  const scrolled = useScrolledPast(120)
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
  const categories = readList(searchParams.get('categorias') ?? '')
  const routeIds = readList(searchParams.get('rutas') ?? '')
  const pointLabels = readList(searchParams.get('puntos') ?? '')
  const photographerIds = readList(searchParams.get('fotografos') ?? '')
  const horaDesde = searchParams.get('hora_desde') ?? ''
  const horaHasta = searchParams.get('hora_hasta') ?? ''

  function setQuery(value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set('q', value)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  function setListParam(key: 'categorias' | 'rutas' | 'puntos' | 'fotografos', values: string[]) {
    const next = new URLSearchParams(searchParams)
    writeList(next, key, values)
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
    pointLabels: pointLabels.length ? pointLabels : undefined,
    photographerIds: photographerIds.length ? photographerIds : undefined,
    horaDesde: horaDesde || undefined,
    horaHasta: horaHasta || undefined,
  })

  const results: GridPhoto[] = rawResults.map((p) => ({
    ...p,
    eventTitle: p.event?.title ?? '',
    photographerName: p.photographer?.display_name ?? '',
    pointLabel: p.point?.label,
  }))

  // Cada campo calcula sus opciones a partir de los DEMÁS filtros elegidos
  // (interconectados en ambas direcciones) — ver `matchingPoints`.
  const fieldFilters: FieldFilters = { categories, routeIds, pointLabels, photographerIds }

  const categoryOptions = dedupeOptions(matchingPoints(events, fieldFilters, 'categories').map((p) => p.event.category))

  const routeIdsAvailable = new Set(
    matchingPoints(events, fieldFilters, 'routeIds')
      .map((p) => p.point.route_point?.route_id)
      .filter((id): id is string => !!id),
  )
  const routeOptions: FilterDropdownOption[] = routes.filter((r) => routeIdsAvailable.has(r.id)).map((r) => ({ value: r.id, label: r.name }))

  // Sin importar cuántos fotógrafos/eventos distintos usen el mismo punto
  // físico, cada uno vive como una fila de `event_points` separada — se
  // deduplica por NOMBRE del punto para que aparezca una sola vez en la
  // lista (ver el comentario de `pointLabels` en `usePublicData.ts`).
  const pointOptions = dedupeOptions(matchingPoints(events, fieldFilters, 'pointLabels').map((p) => p.point.label)).sort((a, b) => a.label.localeCompare(b.label))

  const photographerIdsAvailable = new Set(matchingPoints(events, fieldFilters, 'photographerIds').map((p) => p.event.photographer_id))
  const photographerOptions: FilterDropdownOption[] = photographers
    .filter((p) => photographerIdsAvailable.has(p.id))
    .map((p) => ({ value: p.id, label: p.display_name }))

  // Rango de horario disponible dados TODOS los filtros activos (no hay
  // campo propio que excluir, a diferencia de los de arriba) — si ninguno
  // de los puntos que cumplen los demás filtros tiene horario (o no hay
  // filtros elegidos todavía), el usuario puede elegir cualquier hora del
  // día completo.
  const hourPairs = matchingPoints(events, fieldFilters)
  const boundsMin = hourPairs.length ? Math.min(...hourPairs.map((p) => timeToMinutes(p.point.time_start))) : 0
  const boundsMax = hourPairs.length ? Math.max(...hourPairs.map((p) => timeToMinutes(p.point.time_end))) : 23 * 60 + 59
  const hourActive = Boolean(horaDesde || horaHasta)
  const valueMin = Math.max(boundsMin, Math.min(horaDesde ? timeToMinutes(horaDesde) : boundsMin, boundsMax))
  const valueMax = Math.max(boundsMin, Math.min(horaHasta ? timeToMinutes(horaHasta) : boundsMax, boundsMax))

  function changeHourRange(min: number, max: number) {
    const next = new URLSearchParams(searchParams)
    if (min <= boundsMin && max >= boundsMax) {
      next.delete('hora_desde')
      next.delete('hora_hasta')
    } else {
      next.set('hora_desde', minutesToHHMM(min))
      next.set('hora_hasta', minutesToHHMM(max))
    }
    setSearchParams(next, { replace: true })
  }

  const activeFilterCount = categories.length + routeIds.length + pointLabels.length + photographerIds.length + (hourActive ? 1 : 0)

  const activeChips = [
    query && { key: 'q', label: `"${query}"`, remove: () => setQuery('') },
    ...categories.map((c) => ({ key: `cat-${c}`, label: c, remove: () => setListParam('categorias', categories.filter((v) => v !== c)) })),
    ...routeIds.map((id) => ({
      key: `ruta-${id}`,
      label: routes.find((r) => r.id === id)?.name ?? 'Ruta',
      remove: () => setListParam('rutas', routeIds.filter((v) => v !== id)),
    })),
    ...pointLabels.map((label) => ({ key: `punto-${label}`, label, remove: () => setListParam('puntos', pointLabels.filter((v) => v !== label)) })),
    ...photographerIds.map((id) => ({
      key: `foto-${id}`,
      label: photographers.find((p) => p.id === id)?.display_name ?? 'Fotógrafo',
      remove: () => setListParam('fotografos', photographerIds.filter((v) => v !== id)),
    })),
    hourActive && { key: 'hora', label: `${minutesToHHMM(valueMin)} - ${minutesToHHMM(valueMax)}`, remove: () => changeHourRange(boundsMin, boundsMax) },
  ].filter(Boolean) as { key: string; label: string; remove: () => void }[]

  // Barra de filtros — vive tanto en la página (siempre visible, debajo del
  // hero) como dentro del header interactivo una vez se cruza el umbral de
  // scroll (mismo contenido, un solo lugar de verdad). El usuario filtra
  // directo desde acá: ya no hace falta un botón "Filtros" que abra un
  // modal aparte.
  function renderFilterBar() {
    return (
      <div className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto">
        <FilterDropdown label="Categoría" values={categories} onChange={(v) => setListParam('categorias', v)} options={categoryOptions} />
        <FilterDropdown label="Ruta" values={routeIds} onChange={(v) => setListParam('rutas', v)} options={routeOptions} />
        <FilterDropdown label="Punto" values={pointLabels} onChange={(v) => setListParam('puntos', v)} options={pointOptions} />
        <FilterDropdown label="Fotógrafo" values={photographerIds} onChange={(v) => setListParam('fotografos', v)} options={photographerOptions} />
        <HourRangeDropdown boundsMin={boundsMin} boundsMax={boundsMax} valueMin={valueMin} valueMax={valueMax} active={hourActive} onChange={changeHourRange} />
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
      </div>
    )
  }

  useHeaderTransform(renderFilterBar(), scrolled)

  return (
    <div className="font-flat">
      {/* Hero estático — antes se encogía (max-height) al cruzar el mismo
          umbral que activa el header interactivo, y ese cambio de layout
          bajo los pies del usuario mientras seguía scrolleando se sentía
          como un "jalón" hacia arriba. Ahora es un bloque normal que se
          desplaza como cualquier otro contenido — el header interactivo
          sigue apareciendo al scrollear, pero sin mover nada del layout de
          la página en sí. */}
      <div className="px-4 py-14 text-center md:px-8">
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
        </div>
      </div>

      <div className="mx-auto max-w-[1800px] px-4 md:px-8">
        <div className="mb-5">{renderFilterBar()}</div>

        {activeChips.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {activeChips.map((chip) => (
              <button key={chip.key} onClick={chip.remove}>
                <Badge tone="secondary" className="cursor-pointer gap-1 hover:bg-emerald-200">
                  {chip.label} ✕
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto max-w-[1800px] px-4 pb-8 pt-2 md:px-8">
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
              step={TILE_SIZE_STEP}
              value={tileSize}
              onChange={(e) => changeTileSize(Number(e.target.value))}
              aria-label="Tamaño de las fotos"
              className="h-1.5 w-32 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />
            <IconGridLarge className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </div>

        {/* `key` fuerza a PhotoGrid a re-montar (y así re-disparar la
            animación de entrada de sus primeras fotos) cada vez que cambia
            el conjunto de filtros aplicados — sin esto, cambiar de filtro
            solo reordenaba/recortaba el mismo grid sin dar ninguna señal
            visual de "esto se acaba de refiltrar". */}
        <PhotoGrid
          key={`${categories.join(',')}|${routeIds.join(',')}|${pointLabels.join(',')}|${photographerIds.join(',')}|${horaDesde}|${horaHasta}|${query}`}
          photos={results}
          isLoading={resultsLoading}
          tileSize={tileSize}
          onOpenPhoto={(photos, index) => setLightbox({ photos, index })}
        />
      </div>

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
