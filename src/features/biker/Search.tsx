import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePublicEvents, useApprovedPhotographers, useSearchPhotos, type PublicEvent, type PublicEventPoint } from './usePublicData'
import { useRoutes } from '../shared/useRoutes'
import { PhotoGrid, type GridPhoto } from './components/PhotoGrid'
import { PhotoLightbox } from './components/PhotoLightbox'
import { FilterDropdown, type FilterDropdownOption } from '../../ui/shared/FilterDropdown'
import { TimeRangeSlider } from '../../ui/shared/TimeRangeSlider'
import { IconGridSmall, IconGridLarge, IconClose, IconChevronDown } from '../../ui/shared/icons'
import { ScrollToTopButton } from '../../ui/shared/ScrollToTopButton'
import { useHeaderTransform } from '../../ui/layout/useHeaderTransform'
import { useScrollPastElement } from '../../ui/shared/useScrollPastElement'
import { useIsNarrowViewport } from '../../ui/shared/useIsNarrowViewport'
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
// En móvil el contenedor es mucho más angosto — 130px de mínimo ahí daba
// apenas ~2 columnas en el ajuste MÁS chico del slider. Este piso más bajo
// (calculado para ~360-390px de ancho real de pantalla, con `gap-1` y el
// padding de la página) garantiza al menos 4 columnas incluso en el
// extremo más denso.
const TILE_SIZE_MIN_MOBILE = 70
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
    return Number.isFinite(n) && n >= TILE_SIZE_MIN_MOBILE && n <= TILE_SIZE_MAX ? n : TILE_SIZE_DEFAULT
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
  // Con tantas fotos parecidas, al cerrar el visor es fácil perder de vista
  // cuál era la que se estaba viendo — se guarda su id un momento para que
  // PhotoGrid le ponga un resalte breve (ver `highlightedId`).
  const [justClosedId, setJustClosedId] = useState<string | null>(null)
  function closeLightbox() {
    if (lightbox) {
      const id = lightbox.photos[lightbox.index]?.id ?? null
      setJustClosedId(id)
      setTimeout(() => setJustClosedId((current) => (current === id ? null : current)), 1600)
    }
    setLightbox(null)
  }
  // El header interactivo se activa justo cuando este "centinela" (colocado
  // apenas debajo del hero) queda tapado por el header — no un número de
  // píxeles fijo, sino el layout real de la página.
  const sentinelRef = useRef<HTMLDivElement>(null)
  const scrolled = useScrollPastElement(sentinelRef)
  // Lee localStorage directo en el estado inicial (sin useEffect) — esta es
  // una SPA sin SSR, así que no hay riesgo de mismatch de hidratación.
  const [tileSize, setTileSize] = useState(loadTileSize)
  const isNarrow = useIsNarrowViewport()

  // El piso del resizer en móvil se mide de verdad (ResizeObserver sobre el
  // propio contenedor de la grilla) en vez de un número fijo — un valor fijo
  // "acertaba" 4 columnas en algunos anchos de pantalla y daba 5 en otros
  // (pantallas más anchas caben más columnas para el mismo tamaño mínimo).
  // Con el ancho real disponible se despeja el tamaño exacto que deja
  // EXACTAMENTE 4 columnas, sin importar el dispositivo.
  const gridWrapRef = useRef<HTMLDivElement>(null)
  const [gridWidth, setGridWidth] = useState(0)
  useEffect(() => {
    const el = gridWrapRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setGridWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const GRID_GAP_MOBILE = 4 // `gap-1` en PhotoGrid.tsx
  const mobileFloor = gridWidth > 0 ? Math.max(60, Math.floor((gridWidth - 3 * GRID_GAP_MOBILE) / 4)) : TILE_SIZE_MIN_MOBILE
  const tileSizeMin = isNarrow ? mobileFloor : TILE_SIZE_MIN
  // Columnas REALMENTE renderizadas en móvil (mismo cálculo que hace el CSS
  // `grid-template-columns: repeat(auto-fill, minmax(tileSize,1fr))`) — se
  // usa para decidir, en PhotoCard, si aún caben frescura/acciones por
  // fila. En escritorio no hace falta (ese criterio sigue siendo por
  // tamaño de miniatura, no por columnas).
  const columns = isNarrow && gridWidth > 0 ? Math.max(1, Math.floor((gridWidth + GRID_GAP_MOBILE) / (tileSize + GRID_GAP_MOBILE))) : null

  // Si la pantalla cambia de angosta a ancha (o al revés, ej. al rotar el
  // teléfono) y el valor guardado queda por debajo del nuevo mínimo, se
  // sube justo a ese mínimo — nunca por debajo de lo que el slider permite.
  useEffect(() => {
    setTileSize((t) => Math.max(tileSizeMin, t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileSizeMin])

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

  // Foto a resaltar al llegar desde un link "compartido" (ver
  // SharedPhotoPage.tsx) — trae el id en `?foto=`, se abre el visor sobre
  // ella apenas los resultados terminan de cargar, y se quita el
  // parámetro de la URL (con `replace`) para que no se reabra sola si el
  // usuario cierra el visor y luego recarga o navega hacia atrás.
  const sharedPhotoId = searchParams.get('foto')
  const openedSharedPhotoRef = useRef(false)

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

  useEffect(() => {
    if (!sharedPhotoId || openedSharedPhotoRef.current || resultsLoading) return
    const idx = results.findIndex((p) => p.id === sharedPhotoId)
    if (idx < 0) return
    openedSharedPhotoRef.current = true
    setLightbox({ photos: results, index: idx })
    const next = new URLSearchParams(searchParams)
    next.delete('foto')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedPhotoId, resultsLoading, results])

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

  // Un color distinto por tipo de filtro — con muchos filtros aplicados a
  // la vez, el color ayuda a distinguir de un vistazo "esta chip es de
  // categoría" vs. "esta es de fotógrafo" sin tener que leer cada una.
  const CHIP_TONES = {
    categoria: 'bg-violet-100 text-violet-800 hover:bg-violet-200',
    ruta: 'bg-amber-100 text-amber-800 hover:bg-amber-200',
    fotografo: 'bg-sky-100 text-sky-800 hover:bg-sky-200',
    evento: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
    punto: 'bg-rose-100 text-rose-800 hover:bg-rose-200',
    hora: 'bg-slate-200 text-slate-800 hover:bg-slate-300',
  } as const

  const activeChips = [
    ...categories.map((c) => ({ key: `cat-${c}`, label: c, tone: CHIP_TONES.categoria, remove: () => setListParam('categorias', categories.filter((v) => v !== c)) })),
    ...routeIds.map((id) => ({
      key: `ruta-${id}`,
      label: routes.find((r) => r.id === id)?.name ?? 'Ruta',
      tone: CHIP_TONES.ruta,
      remove: () => setListParam('rutas', routeIds.filter((v) => v !== id)),
    })),
    ...eventIds.map((id) => ({
      key: `evento-${id}`,
      label: eventOptionsMap.get(id) ?? events.find((e) => e.id === id)?.title ?? 'Evento',
      tone: CHIP_TONES.evento,
      remove: () => setListParam('eventos', eventIds.filter((v) => v !== id)),
    })),
    ...pointLabels.map((label) => ({ key: `punto-${label}`, label, tone: CHIP_TONES.punto, remove: () => setListParam('puntos', pointLabels.filter((v) => v !== label)) })),
    ...photographerIds.map((id) => ({
      key: `foto-${id}`,
      label: photographers.find((p) => p.id === id)?.display_name ?? 'Fotógrafo',
      tone: CHIP_TONES.fotografo,
      remove: () => setListParam('fotografos', photographerIds.filter((v) => v !== id)),
    })),
    hourActive && {
      key: 'hora',
      label: `${minutesToHHMM(valueMin)} - ${minutesToHHMM(valueMax)}`,
      tone: CHIP_TONES.hora,
      remove: () => changeHourRange(boundsMin, boundsMax),
    },
  ].filter(Boolean) as { key: string; label: string; tone: string; remove: () => void }[]

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
  // sobra caben en una fila; si no, envuelve solo. En el header (texto):
  // en escritorio los 6 viven en UNA sola fila (nunca en dos, a diferencia
  // de móvil); en móvil solo los primeros 3 se ven de entrada, y los otros
  // 3 viven en la tarjeta flotante que "más filtros" revela (ver
  // `mobileExpanded`) — dos copias separadas de los mismos 3 controles,
  // una por escritorio (siempre en la fila) y otra por móvil (en la fila
  // que crece), cada una mostrándose solo en su propio breakpoint.
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
        {/* Escritorio: los otros 3 filtros viven acá mismo, en la MISMA
            fila (nunca en una segunda fila) — solo visibles a partir de
            `sm`. En móvil no ocupan espacio (`hidden`); ahí esos 3 viven en
            la copia de `renderHeaderSecondaryFilters`, en la fila que el
            header hace crecer al tocar "más filtros" (el botón que
            reemplaza la flecha de volver, ver `mobileBackSlotContent`). El
            botón de limpiar también vive solo ahí en móvil — en escritorio
            se queda aquí, al final de la única fila. */}
        <div className="hidden shrink-0 flex-nowrap items-center gap-x-4 sm:flex">
          <FilterDropdown variant="text" label="Evento" values={eventIds} onChange={(v) => setListParam('eventos', v)} options={eventOptions} />
          <FilterDropdown variant="text" label="Punto" values={pointLabels} onChange={(v) => setListParam('puntos', v)} options={pointOptions} />
          <HourRangeBar variant="text" boundsMin={boundsMin} boundsMax={boundsMax} valueMin={valueMin} valueMax={valueMax} onChange={changeHourRange} />
          {clearButton}
        </div>
      </div>
    )
  }

  // Fila que el header hace crecer en móvil al tocar "más filtros" — se
  // centra (en vez de alinearse a la izquierda) porque puede quedar con
  // espacio libre debajo del ícono del carrito, y centrado se ve más
  // intencional que un bloque pegado a un lado. El botón de limpiar vive
  // acá abajo (no en la fila principal) para que los 3 filtros + horario +
  // limpiar quepan sin apretarse contra el ícono de "más filtros".
  function renderHeaderSecondaryFilters() {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3" onClick={bumpIdleTimer}>
        <FilterDropdown variant="text" label="Evento" values={eventIds} onChange={(v) => setListParam('eventos', v)} options={eventOptions} />
        <FilterDropdown variant="text" label="Punto" values={pointLabels} onChange={(v) => setListParam('puntos', v)} options={pointOptions} />
        <HourRangeBar variant="text" boundsMin={boundsMin} boundsMax={boundsMax} valueMin={valueMin} valueMax={valueMax} onChange={changeHourRange} />
        {clearButton}
      </div>
    )
  }

  // El botón que extiende el header en móvil ocupa EXACTAMENTE el mismo
  // lugar que la flecha de "volver" en el resto de páginas (mismo hueco,
  // mismo tamaño) — ver `mobileBackSlotContent` en HeaderUser.tsx. En
  // escritorio esta página no usa nada de esto: los 6 filtros ya viven
  // juntos en una sola fila dentro de `content` (ver arriba), así que
  // `extraActive` nunca se activa ahí.
  const mobileMoreFiltersButton = (
    <button
      onClick={() => setMobileExpanded((v) => !v)}
      aria-label="Más filtros"
      title="Más filtros"
      className="flex h-full w-full items-center justify-center text-foreground transition-colors hover:text-muted-foreground"
    >
      <IconChevronDown className={cn('h-5 w-5 transition-transform duration-300', mobileExpanded && 'rotate-180')} />
    </button>
  )

  useHeaderTransform(renderHeaderPrimaryFilters(), scrolled, {
    mobileEnabled: true,
    mobileBackSlotContent: mobileMoreFiltersButton,
    extraContent: renderHeaderSecondaryFilters(),
    extraActive: isNarrow && mobileExpanded,
  })

  return (
    <div className="font-flat">
      {/* Hero estático — ya no se encoge con el scroll (ese cambio de
          layout bajo los pies del usuario se sentía como un "jalón" hacia
          arriba). El header interactivo aparece por scroll real (ver
          `sentinelRef` más abajo), sin mover nada de este bloque. */}
      <div className="px-4 py-8 text-center md:px-8 md:py-14">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">Encuentra tus fotos en segundos.</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">{heroDescription}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{results.length}</span> fotos disponibles ahora mismo
        </p>
      </div>

      {/* El centinela vive justo debajo del hero — el header interactivo se
          activa exactamente cuando este bloque queda tapado por el header. */}
      <div ref={sentinelRef} />

      {/* Margen lateral reducido (antes px-4/md:px-8) — el usuario pidió
          achicarlo un poco para que el aire entre la última foto de cada
          fila y el borde de la página se pareciera más al gap entre
          fotos, en vez de sentirse desproporcionadamente más ancho. */}
      <div className="mx-auto max-w-[1800px] px-2 md:px-4">
        <div className="mb-5">{renderPillFilters()}</div>

        {activeChips.length > 0 && (
          // Una sola fila desplazable (no envuelve en varias) — con muchos
          // filtros aplicados, envolver en 2-3 filas se comía demasiado
          // espacio vertical; un scroll horizontal contenido cuesta menos
          // que eso, y el usuario igual puede eliminar cada chip con un
          // click sin tener que "encontrarla" entre varias filas.
          <div className="mb-5 -mx-2 flex gap-2 overflow-x-auto px-2 pb-1 sm:justify-center sm:overflow-visible sm:px-0">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                onClick={chip.remove}
                className={cn('flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors', chip.tone)}
              >
                {chip.label}
                <IconClose className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={gridWrapRef} className="mx-auto max-w-[1800px] px-2 pb-8 pt-2 md:px-4">
        {/* Contador + resizer de tamaño de foto — ahora también en móvil
            (antes el control de densidad era solo de escritorio); en
            pantallas angostas el slider simplemente se ve un poco más
            corto para no competir por espacio con el contador. Los íconos
            de los extremos también son botones: un click acerca/aleja un
            paso sin tener que arrastrar la barra. */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{results.length}</span> fotos encontradas
          </p>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => changeTileSize(Math.max(tileSizeMin, tileSize - TILE_SIZE_STEP))}
              aria-label="Fotos más chicas"
              className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <IconGridSmall className="h-4 w-4" />
            </button>
            <input
              type="range"
              min={tileSizeMin}
              max={TILE_SIZE_MAX}
              step={TILE_SIZE_STEP}
              value={tileSize}
              onChange={(e) => changeTileSize(Number(e.target.value))}
              aria-label="Tamaño de las fotos"
              className="h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-muted accent-primary sm:w-32"
            />
            <button
              onClick={() => changeTileSize(Math.min(TILE_SIZE_MAX, tileSize + TILE_SIZE_STEP))}
              aria-label="Fotos más grandes"
              className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <IconGridLarge className="h-4 w-4" />
            </button>
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
          columns={columns}
          highlightedId={justClosedId}
          onOpenPhoto={(photos, index) => setLightbox({ photos, index })}
        />
      </div>

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() => closeLightbox()}
          onNavigate={(index) => setLightbox({ photos: lightbox.photos, index })}
          shareSearchParams={searchParams.toString()}
        />
      )}

      <ScrollToTopButton />
    </div>
  )
}
