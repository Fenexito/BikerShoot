import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { usePublicEvents, useApprovedPhotographers, useSearchPhotos, type PublicEvent, type PublicEventPoint } from './usePublicData'
import { useRoutes } from '../shared/useRoutes'
import { PhotoGrid, type GridPhoto } from './components/PhotoGrid'
import { PhotoLightbox } from './components/PhotoLightbox'
import { Badge } from '../../ui/flat/Badge'
import { FilterDropdown, type FilterDropdownOption } from '../../ui/shared/FilterDropdown'
import { TimeRangeSlider } from '../../ui/shared/TimeRangeSlider'
import { getPortalRoot } from '../../ui/shared/portalRoot'
import { IconGridSmall, IconGridLarge, IconClose, IconChevronDown } from '../../ui/shared/icons'
import { ScrollToTopButton } from '../../ui/shared/ScrollToTopButton'
import { useHeaderTransform } from '../../ui/layout/useHeaderTransform'
import { useScrollPastElement } from '../../ui/shared/useScrollPastElement'
import { cn } from '../../lib/cn'

// Orden fijo (no alfabético ni de aparición) — el biker espera verlas
// siempre en este orden sin importar cuáles estén disponibles en cada
// combinación de filtros.
const CATEGORY_ORDER = ['Rodada', 'Pista', 'Sesión de Fotos']

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

const MOBILE_EXPAND_IDLE_MS = 5000

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
  eventIds: string[]
  pointLabels: string[]
  photographerIds: string[]
}

/** Todos los pares evento+punto que cumplen los filtros elegidos — EXCEPTO
 * el campo `skip`, para poder calcular las opciones de ESE campo a partir de
 * los demás ("interconectados": elegir un fotógrafo limita categoría/ruta/
 * evento/punto a lo que ese fotógrafo realmente tiene, y viceversa con
 * cualquier otro campo). Sin `skip`, aplica los cinco filtros a la vez
 * (usado para calcular el rango de horario disponible). */
function matchingPoints(events: PublicEvent[], f: FieldFilters, skip?: keyof FieldFilters): { event: PublicEvent; point: PublicEventPoint }[] {
  const eff: FieldFilters = { ...f, ...(skip ? { [skip]: [] } : {}) }
  const pairs: { event: PublicEvent; point: PublicEventPoint }[] = []
  for (const e of events) {
    if (eff.categories.length && !eff.categories.includes(e.category)) continue
    if (eff.photographerIds.length && !eff.photographerIds.includes(e.photographer_id)) continue
    if (eff.eventIds.length && !eff.eventIds.includes(e.id)) continue
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

function orderedCategoryOptions(values: string[]): FilterDropdownOption[] {
  const present = new Set(values)
  return CATEGORY_ORDER.filter((c) => present.has(c)).map((c) => ({ value: c, label: c }))
}

/** Barra SIEMPRE visible (no un menú desplegable que hay que abrir) — el
 * horario es un rango, no una opción de una lista, así que tiene más
 * sentido como control directo que como algo escondido detrás de un click. */
function HourRangeBar({
  boundsMin,
  boundsMax,
  valueMin,
  valueMax,
  onChange,
  variant = 'pill',
}: {
  boundsMin: number
  boundsMax: number
  valueMin: number
  valueMax: number
  onChange: (min: number, max: number) => void
  variant?: 'pill' | 'text'
}) {
  return (
    <div className="shrink-0">
      <TimeRangeSlider boundsMin={boundsMin} boundsMax={boundsMax} valueMin={valueMin} valueMax={valueMax} onChange={onChange} size={variant === 'text' ? 'compact' : 'default'} />
    </div>
  )
}

export function Search() {
  const { data: events = [] } = usePublicEvents()
  const { data: photographers = [] } = useApprovedPhotographers()
  const { data: routes = [] } = useRoutes()
  const [searchParams, setSearchParams] = useSearchParams()
  const [lightbox, setLightbox] = useState<{ photos: GridPhoto[]; index: number } | null>(null)
  // El header interactivo se activa justo cuando este "centinela" (colocado
  // apenas debajo del hero) queda tapado por el header — no un número de
  // píxeles fijo, sino el layout real de la página.
  const sentinelRef = useRef<HTMLDivElement>(null)
  const scrolled = useScrollPastElement(sentinelRef)
  // Lee localStorage directo en el estado inicial (sin useEffect) — esta es
  // una SPA sin SSR, así que no hay riesgo de mismatch de hidratación.
  const [tileSize, setTileSize] = useState(loadTileSize)

  // En el header interactivo (móvil sobre todo) solo caben 3 filtros —
  // "más filtros" reemplaza el hueco de la flecha de "volver" (que esta
  // página no usa) y revela los otros 3 en una tarjeta flotante debajo del
  // header. Se colapsa solo tras 5s sin interacción, o si el usuario sigue
  // bajando en la página — así no se queda estorbando la vista de fotos.
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function bumpIdleTimer() {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => setMobileExpanded(false), MOBILE_EXPAND_IDLE_MS)
  }

  // Si el header vuelve a su estado normal (el usuario subió de nuevo por
  // encima del centinela), la tarjeta de "más filtros" no debe quedar
  // huérfana flotando bajo un header que ya no muestra filtros.
  useEffect(() => {
    if (!scrolled) setMobileExpanded(false)
  }, [scrolled])

  useEffect(() => {
    if (!mobileExpanded) return
    bumpIdleTimer()
    let lastY = window.scrollY
    function onScroll() {
      const y = window.scrollY
      if (y > lastY + 4) setMobileExpanded(false)
      lastY = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileExpanded])

  function changeTileSize(next: number) {
    setTileSize(next)
    try {
      localStorage.setItem(TILE_SIZE_KEY, String(next))
    } catch {
      // localStorage puede fallar (modo privado, cuota llena) — el tamaño
      // elegido simplemente no se recuerda la próxima vez, no es grave.
    }
  }

  const categories = readList(searchParams.get('categorias') ?? '')
  const routeIds = readList(searchParams.get('rutas') ?? '')
  const eventIds = readList(searchParams.get('eventos') ?? '')
  const pointLabels = readList(searchParams.get('puntos') ?? '')
  const photographerIds = readList(searchParams.get('fotografos') ?? '')
  const horaDesde = searchParams.get('hora_desde') ?? ''
  const horaHasta = searchParams.get('hora_hasta') ?? ''

  function setListParam(key: 'categorias' | 'rutas' | 'eventos' | 'puntos' | 'fotografos', values: string[]) {
    const next = new URLSearchParams(searchParams)
    writeList(next, key, values)
    setSearchParams(next, { replace: true })
  }

  function clearAllFilters() {
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  const { data: rawResults = [], isLoading: resultsLoading } = useSearchPhotos({
    categories: categories.length ? categories : undefined,
    routeIds: routeIds.length ? routeIds : undefined,
    eventIds: eventIds.length ? eventIds : undefined,
    pointLabels: pointLabels.length ? pointLabels : undefined,
    photographerIds: photographerIds.length ? photographerIds : undefined,
    horaDesde: horaDesde || undefined,
    horaHasta: horaHasta || undefined,
  })

  // Las destacadas son curadas por el fotógrafo como muestra — nunca están
  // a la venta (ver PhotoCard.tsx) — así que no deben aparecer como
  // resultado en esta búsqueda de fotos PARA COMPRAR. Se excluyen aquí (no
  // en `useSearchPhotos`, que también usan Home.tsx para su collage
  // decorativo y Favorites.tsx para favoritos ya guardados — ahí sí pueden
  // aparecer destacadas).
  const results: GridPhoto[] = rawResults
    .filter((p) => !p.featured)
    .map((p) => ({
      ...p,
      eventTitle: p.event?.title ?? '',
      photographerName: p.photographer?.display_name ?? '',
      pointLabel: p.point?.label,
    }))

  // Cada campo calcula sus opciones a partir de los DEMÁS filtros elegidos
  // (interconectados en ambas direcciones) — ver `matchingPoints`.
  const fieldFilters: FieldFilters = { categories, routeIds, eventIds, pointLabels, photographerIds }

  const categoryOptions = orderedCategoryOptions(matchingPoints(events, fieldFilters, 'categories').map((p) => p.event.category))

  const routeIdsAvailable = new Set(
    matchingPoints(events, fieldFilters, 'routeIds')
      .map((p) => p.point.route_point?.route_id)
      .filter((id): id is string => !!id),
  )
  const routeOptions: FilterDropdownOption[] = routes.filter((r) => routeIdsAvailable.has(r.id)).map((r) => ({ value: r.id, label: r.name }))

  const eventOptionsMap = new Map<string, string>()
  for (const p of matchingPoints(events, fieldFilters, 'eventIds')) eventOptionsMap.set(p.event.id, p.event.title)
  const eventOptions: FilterDropdownOption[] = Array.from(eventOptionsMap, ([value, label]) => ({ value, label }))

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

  const activeFilterCount = categories.length + routeIds.length + eventIds.length + pointLabels.length + photographerIds.length + (hourActive ? 1 : 0)

  const activeChips = [
    ...categories.map((c) => ({ key: `cat-${c}`, label: c, remove: () => setListParam('categorias', categories.filter((v) => v !== c)) })),
    ...routeIds.map((id) => ({
      key: `ruta-${id}`,
      label: routes.find((r) => r.id === id)?.name ?? 'Ruta',
      remove: () => setListParam('rutas', routeIds.filter((v) => v !== id)),
    })),
    ...eventIds.map((id) => ({
      key: `evento-${id}`,
      label: eventOptionsMap.get(id) ?? events.find((e) => e.id === id)?.title ?? 'Evento',
      remove: () => setListParam('eventos', eventIds.filter((v) => v !== id)),
    })),
    ...pointLabels.map((label) => ({ key: `punto-${label}`, label, remove: () => setListParam('puntos', pointLabels.filter((v) => v !== label)) })),
    ...photographerIds.map((id) => ({
      key: `foto-${id}`,
      label: photographers.find((p) => p.id === id)?.display_name ?? 'Fotógrafo',
      remove: () => setListParam('fotografos', photographerIds.filter((v) => v !== id)),
    })),
    hourActive && { key: 'hora', label: `${minutesToHHMM(valueMin)} - ${minutesToHHMM(valueMax)}`, remove: () => changeHourRange(boundsMin, boundsMax) },
  ].filter(Boolean) as { key: string; label: string; remove: () => void }[]

  // Descripción dinámica del hero — reemplaza el texto genérico en cuanto
  // hay algún filtro multi-selectivo elegido.
  const filterDescriptionParts = [
    categories.length && categories.join(', '),
    routeIds.length && `ruta ${routeIds.map((id) => routes.find((r) => r.id === id)?.name).filter(Boolean).join(', ')}`,
    eventIds.length && `evento ${eventIds.map((id) => eventOptionsMap.get(id)).filter(Boolean).join(', ')}`,
    pointLabels.length && `punto ${pointLabels.join(', ')}`,
    photographerIds.length && `fotógrafo ${photographerIds.map((id) => photographers.find((p) => p.id === id)?.display_name).filter(Boolean).join(', ')}`,
    hourActive && `entre ${minutesToHHMM(valueMin)} y ${minutesToHHMM(valueMax)}`,
  ].filter(Boolean) as string[]
  const heroDescription = filterDescriptionParts.length > 0 ? `Filtrando por ${filterDescriptionParts.join(' · ')}` : 'Elige categoría, ruta, fotógrafo, evento, punto u horario para empezar.'

  const clearButton = (
    <button
      onClick={clearAllFilters}
      aria-label="Limpiar filtros"
      title="Limpiar filtros"
      // `invisible` (no `hidden`/desmontar condicional): reserva su espacio
      // siempre, así aparecer/desaparecer no empuja el resto de los
      // filtros de lugar.
      className={cn('shrink-0 text-red-500 transition-colors hover:text-red-600', activeFilterCount === 0 && 'invisible')}
    >
      <IconClose className="h-4 w-4" />
    </button>
  )

  // Orden fijo en TODOS lados: Categoría, Ruta, Fotógrafo, Evento, Punto,
  // Horario. En la página (pastillas) es un solo `flex-wrap` — con ancho de
  // sobra caben en una fila; si no, envuelve solo. En el header (texto) los
  // primeros 3 van siempre visibles; los otros 3 viven en la tarjeta
  // flotante que "más filtros" revela (ver `mobileExpanded`).
  function renderPillFilters() {
    return (
      <div className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <FilterDropdown label="Categoría" values={categories} onChange={(v) => setListParam('categorias', v)} options={categoryOptions} />
        <FilterDropdown label="Ruta" values={routeIds} onChange={(v) => setListParam('rutas', v)} options={routeOptions} />
        <FilterDropdown label="Fotógrafo" values={photographerIds} onChange={(v) => setListParam('fotografos', v)} options={photographerOptions} />
        <FilterDropdown label="Evento" values={eventIds} onChange={(v) => setListParam('eventos', v)} options={eventOptions} />
        <FilterDropdown label="Punto" values={pointLabels} onChange={(v) => setListParam('puntos', v)} options={pointOptions} />
        <HourRangeBar boundsMin={boundsMin} boundsMax={boundsMax} valueMin={valueMin} valueMax={valueMax} onChange={changeHourRange} />
        {clearButton}
      </div>
    )
  }

  function renderHeaderPrimaryFilters() {
    return (
      <div className="flex w-full flex-nowrap items-center gap-x-4 overflow-x-auto">
        <FilterDropdown variant="text" label="Categoría" values={categories} onChange={(v) => setListParam('categorias', v)} options={categoryOptions} />
        <FilterDropdown variant="text" label="Ruta" values={routeIds} onChange={(v) => setListParam('rutas', v)} options={routeOptions} />
        <FilterDropdown variant="text" label="Fotógrafo" values={photographerIds} onChange={(v) => setListParam('fotografos', v)} options={photographerOptions} />
        <button
          onClick={() => setMobileExpanded((v) => !v)}
          aria-label="Más filtros"
          title="Más filtros"
          className="flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Más
          <IconChevronDown className={cn('h-3.5 w-3.5 transition-transform', mobileExpanded && 'rotate-180')} />
        </button>
        {clearButton}
      </div>
    )
  }

  function renderHeaderSecondaryFilters() {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3" onClick={bumpIdleTimer}>
        <FilterDropdown variant="text" label="Evento" values={eventIds} onChange={(v) => setListParam('eventos', v)} options={eventOptions} />
        <FilterDropdown variant="text" label="Punto" values={pointLabels} onChange={(v) => setListParam('puntos', v)} options={pointOptions} />
        <HourRangeBar variant="text" boundsMin={boundsMin} boundsMax={boundsMax} valueMin={valueMin} valueMax={valueMax} onChange={changeHourRange} />
      </div>
    )
  }

  // `hideBackSlotOnMobile`: esta página no usa la flecha de "volver" — ese
  // hueco se libera en móvil para que "Más" (el botón de arriba) viva ahí
  // en su lugar, en vez de dejarlo vacío.
  useHeaderTransform(renderHeaderPrimaryFilters(), scrolled, { mobileEnabled: true, hideBackSlotOnMobile: true })

  return (
    <div className="font-flat">
      {/* Hero estático — ya no se encoge con el scroll (ese cambio de
          layout bajo los pies del usuario se sentía como un "jalón" hacia
          arriba). El header interactivo aparece por scroll real (ver
          `sentinelRef` más abajo), sin mover nada de este bloque. */}
      <div className="px-4 py-14 text-center md:px-8">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">Encuentra tus fotos en segundos.</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">{heroDescription}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{results.length}</span> fotos disponibles ahora mismo
        </p>
      </div>

      {/* El centinela vive justo debajo del hero — el header interactivo se
          activa exactamente cuando este bloque queda tapado por el header. */}
      <div ref={sentinelRef} />

      <div className="mx-auto max-w-[1800px] px-4 md:px-8">
        <div className="mb-5">{renderPillFilters()}</div>

        {activeChips.length > 0 && (
          <div className="mb-5 flex flex-wrap justify-center gap-2">
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
        {/* Contador + resizer de tamaño de foto — ahora también en móvil
            (antes el control de densidad era solo de escritorio); en
            pantallas angostas el slider simplemente se ve un poco más
            corto para no competir por espacio con el contador. */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{results.length}</span> fotos encontradas
          </p>
          <div className="flex items-center gap-2 sm:gap-3">
            <IconGridSmall className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="range"
              min={TILE_SIZE_MIN}
              max={TILE_SIZE_MAX}
              step={TILE_SIZE_STEP}
              value={tileSize}
              onChange={(e) => changeTileSize(Number(e.target.value))}
              aria-label="Tamaño de las fotos"
              className="h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-muted accent-primary sm:w-32"
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
          key={`${categories.join(',')}|${routeIds.join(',')}|${eventIds.join(',')}|${pointLabels.join(',')}|${photographerIds.join(',')}|${horaDesde}|${horaHasta}`}
          photos={results}
          isLoading={resultsLoading}
          tileSize={tileSize}
          onOpenPhoto={(photos, index) => setLightbox({ photos, index })}
        />
      </div>

      {mobileExpanded &&
        createPortal(
          <div className="fixed left-3 right-3 top-[76px] z-40 rounded-3xl border border-border bg-background p-4 shadow-2xl sm:left-4 sm:right-4 sm:top-20">
            {renderHeaderSecondaryFilters()}
          </div>,
          getPortalRoot(),
        )}

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
