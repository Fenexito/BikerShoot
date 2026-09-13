import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useMyEvents } from '../useMyEvents'
import { usePhotographerOrders } from '../useMyOrders'
import { supabase } from '../../../lib/supabase'
import { r2Url, previewUrl } from '../../../lib/r2'
import { formatOrderCode } from '../../../lib/orderStatus'
import { EVENT_STATUS_STYLE } from '../../../lib/eventStatus'
import { getPortalRoot } from '../../../ui/shared/portalRoot'
import { InitialsAvatar } from '../../../ui/shared/InitialsAvatar'
import { IconImages, IconCart, IconUser, IconArchive, IconCreditCard, IconSettings, IconPlus } from '../../../ui/shared/icons'
import { AnimateIcon } from '../../../ui/animate-icons/icon'
import { Search } from '../../../ui/animate-icons/icons/Search'
import { X } from '../../../ui/animate-icons/icons/X'
import { cn } from '../../../lib/cn'

type SearchCategory = 'bikers' | 'eventos' | 'pedidos' | 'fotos' | 'paginas'

interface SearchResult {
  id: string
  category: SearchCategory
  title: string
  subtitle: string
  to: string
  thumbnail?: string | null
  icon?: React.ReactNode
}

const CATEGORY_LABELS: Record<SearchCategory, string> = {
  bikers: 'Bikers',
  eventos: 'Eventos',
  pedidos: 'Pedidos',
  fotos: 'Fotos',
  paginas: 'Páginas y funciones',
}

const RECENTS_KEY = 'motoshots_studio_recent_searches'
const MAX_RECENTS = 8

function loadRecents(): SearchResult[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

// Nota: el ícono JSX de una página estática no sobrevive JSON.stringify, así
// que los "recientes" de páginas se guardan sin `icon` — la fila los pinta
// igual con el marcador de puntito genérico, no rompe nada.
function saveRecent(result: SearchResult) {
  try {
    const { icon: _icon, ...serializable } = result
    const current = loadRecents().filter((r) => !(r.id === result.id && r.category === result.category))
    const next = [serializable as SearchResult, ...current].slice(0, MAX_RECENTS)
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    // localStorage puede fallar (modo privado, cuota llena) — los
    // recientes son una conveniencia, nunca deben tumbar la búsqueda.
  }
}

const STATIC_PAGES: { id: string; title: string; subtitle: string; to: string; icon: React.ReactNode }[] = [
  { id: 'p-eventos', title: 'Eventos', subtitle: 'Ver todos tus eventos', to: '/studio/eventos', icon: <IconImages className="h-4 w-4" /> },
  { id: 'p-crear-evento', title: 'Crear evento', subtitle: 'Publicar un nuevo evento', to: '/studio/eventos/new', icon: <IconPlus className="h-4 w-4" /> },
  { id: 'p-pedidos', title: 'Pedidos', subtitle: 'Ver pedidos de bikers', to: '/studio/pedidos', icon: <IconCart className="h-4 w-4" /> },
  { id: 'p-almacenamiento', title: 'Almacenamiento', subtitle: 'Administrar espacio y limpieza', to: '/studio/almacenamiento', icon: <IconArchive className="h-4 w-4" /> },
  { id: 'p-planes', title: 'Planes', subtitle: 'Planes y facturación', to: '/studio/planes', icon: <IconCreditCard className="h-4 w-4" /> },
  { id: 'p-perfil', title: 'Mi perfil', subtitle: 'Editar tu perfil público', to: '/studio/perfil', icon: <IconUser className="h-4 w-4" /> },
  { id: 'p-ajustes', title: 'Configuración', subtitle: 'Ajustes de tu cuenta', to: '/studio/ajustes', icon: <IconSettings className="h-4 w-4" /> },
  { id: 'p-editar-avatar', title: 'Editar foto de perfil', subtitle: 'Configuración → Perfil', to: '/studio/ajustes', icon: <IconUser className="h-4 w-4" /> },
  { id: 'p-editar-portada', title: 'Editar portada', subtitle: 'Configuración → Perfil', to: '/studio/ajustes', icon: <IconImages className="h-4 w-4" /> },
  { id: 'p-editar-logo', title: 'Editar logo del estudio', subtitle: 'Configuración → Perfil', to: '/studio/ajustes', icon: <IconImages className="h-4 w-4" /> },
]

function ResultThumb({ r, className }: { r: SearchResult; className: string }) {
  if (r.thumbnail) return <img src={r.thumbnail} alt="" className={cn(className, 'object-cover')} />
  if (r.category === 'bikers') return <InitialsAvatar name={r.title} className={cn(className, 'bg-white/10 text-white')} />
  if (r.icon) return <span className={cn(className, 'flex items-center justify-center bg-white/10')}>{r.icon}</span>
  return <span className={cn(className, 'flex items-center justify-center bg-white/10 text-xs')}>•</span>
}

/** Búsqueda global del portal del fotógrafo — bikers, eventos, pedidos,
 * fotos (por nombre de archivo) y páginas/funciones. Categorías como
 * pestañas verticales a la izquierda (mismo patrón que el editor de evento/
 * configuración), resultados a la derecha, y un panel de vista previa que
 * se llena al pasar el cursor sobre un resultado. Bikers/eventos/pedidos/
 * páginas se filtran en el cliente sobre datos ya cargados por otros hooks;
 * fotos es la única categoría con su propia consulta (debounced), porque
 * buscar por nombre de archivo entre miles de fotos no tiene sentido
 * traerlo completo al cliente de antemano. */
export function GlobalSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<'todos' | SearchCategory>('todos')
  const [hovered, setHovered] = useState<SearchResult | null>(null)
  const [recents, setRecents] = useState<SearchResult[]>([])
  const [visibleRecents, setVisibleRecents] = useState<SearchResult[]>([])
  const recentsRowRef = useRef<HTMLDivElement>(null)
  const { data: events = [] } = useMyEvents(user?.id)
  const { data: orders = [] } = usePhotographerOrders(user?.id)
  const [photoResults, setPhotoResults] = useState<SearchResult[]>([])
  const [searchingPhotos, setSearchingPhotos] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    // Bloquea el scroll en <html> (el `scrollingElement` real de la app,
    // confirmado — ver [[motoshots_v2_layout_overflow_bugs]]) Y en <body>:
    // bloquear solo body no bastaba, sobre todo en móvil, porque quien
    // realmente scrollea es html/window, no body.
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

  useEffect(() => {
    if (open) {
      setRecents(loadRecents())
    } else {
      setQuery('')
      setActiveCategory('todos')
      setPhotoResults([])
      setHovered(null)
    }
  }, [open])

  // Los recientes nunca deben pasar a una segunda línea — si el nombre de
  // alguna búsqueda es largo y no cabe, se descartan las más ANTIGUAS (el
  // final del array; las más nuevas siempre van primero) hasta que la fila
  // completa quepa en una sola línea. Se re-mide en cada recorte porque
  // quitar un chip puede o no ser suficiente.
  useEffect(() => {
    setVisibleRecents(recents)
  }, [recents])

  useLayoutEffect(() => {
    const el = recentsRowRef.current
    if (!el || visibleRecents.length === 0) return
    if (el.scrollWidth > el.clientWidth) {
      setVisibleRecents((prev) => prev.slice(0, -1))
    }
  }, [visibleRecents])

  // Fotos: la única categoría que consulta la base de datos directamente
  // (por nombre de archivo), con un pequeño debounce — el resto ya vive en
  // memoria vía useMyEvents/usePhotographerOrders.
  useEffect(() => {
    if (!open || !user || query.trim().length < 2) {
      setPhotoResults([])
      return
    }
    let cancelled = false
    setSearchingPhotos(true)
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from('photos')
        .select('id, original_filename, preview_path, event_id, events(title)')
        .eq('photographer_id', user.id)
        .ilike('original_filename', `%${query.trim()}%`)
        .limit(8)
      if (!cancelled) {
        setPhotoResults(
          (data ?? []).map((p) => ({
            id: p.id,
            category: 'fotos' as const,
            title: p.original_filename ?? 'Sin nombre',
            subtitle: (Array.isArray(p.events) ? p.events[0]?.title : (p.events as { title: string } | null)?.title) ?? '',
            to: `/studio/eventos/${p.event_id}`,
            thumbnail: p.preview_path ? previewUrl({ storage_path: null, preview_path: p.preview_path }) : null,
          })),
        )
      }
      setSearchingPhotos(false)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query, open, user])

  const bikers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; orderCount: number; lastOrderId: string }>()
    for (const o of orders) {
      const key = o.bikerId ?? o.bikerName
      const existing = map.get(key)
      if (existing) existing.orderCount += 1
      else map.set(key, { id: key, name: o.bikerName, orderCount: 1, lastOrderId: o.orderId })
    }
    return [...map.values()]
  }, [orders])

  const resultsByCategory = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = (s: string) => !q || s.toLowerCase().includes(q)

    const rBikers: SearchResult[] = bikers
      .filter((b) => matches(b.name))
      .map((b) => ({ id: b.id, category: 'bikers' as const, title: b.name, subtitle: `${b.orderCount} pedido${b.orderCount > 1 ? 's' : ''}`, to: `/studio/pedidos/${b.lastOrderId}` }))

    const rEventos: SearchResult[] = events
      .filter((e) => matches(e.title) || matches(e.city))
      .map((e) => ({
        id: e.id,
        category: 'eventos' as const,
        title: e.title,
        subtitle: `${e.city} · ${EVENT_STATUS_STYLE[e.status].label}`,
        to: `/studio/eventos/${e.id}`,
        thumbnail: e.cover_path ? r2Url(e.cover_path) : null,
      }))

    const rPedidos: SearchResult[] = orders
      .filter((o) => matches(o.bikerName) || matches(o.eventTitle) || matches(String(o.orderNumber ?? '')))
      .map((o) => ({ id: o.orderId, category: 'pedidos' as const, title: formatOrderCode(o.orderNumber), subtitle: `${o.bikerName} · ${o.eventTitle}`, to: `/studio/pedidos/${o.orderId}` }))

    const rPaginas: SearchResult[] = STATIC_PAGES.filter((p) => matches(p.title) || matches(p.subtitle)).map((p) => ({ ...p, category: 'paginas' as const }))

    return { bikers: rBikers, eventos: rEventos, pedidos: rPedidos, fotos: photoResults, paginas: rPaginas } as Record<SearchCategory, SearchResult[]>
  }, [query, events, orders, bikers, photoResults])

  const categoryOrder: SearchCategory[] = ['bikers', 'eventos', 'pedidos', 'fotos', 'paginas']
  // En móvil las categorías son solo estas 4 pestañas (ni "Fotos" ni
  // "Páginas y funciones" — decisión explícita: 4 pestañas fijas,
  // justificadas al ancho del modal, no una fila que haya que scrollear).
  // "Todos" en móvil sigue agrupando TODOS los resultados (fotos y páginas
  // incluidas) — solo no existe una pestaña dedicada para filtrar por ellas.
  const mobileCategoryOrder: SearchCategory[] = ['bikers', 'eventos', 'pedidos']
  const totalCount = categoryOrder.reduce((s, c) => s + resultsByCategory[c].length, 0)
  const visibleCategories = activeCategory === 'todos' ? categoryOrder : [activeCategory]

  function selectResult(r: SearchResult) {
    saveRecent(r)
    onClose()
    navigate(r.to)
  }

  if (!open) return null

  // En móvil el teclado no debe abrirse solo — el usuario lo activa al
  // tocar el campo. Se evalúa en cada apertura (el componente se desmonta
  // por completo con `!open`, así que esto corre de nuevo cada vez), no
  // reactivo a un resize mientras el modal ya está abierto — eso está bien,
  // `autoFocus` solo importa en el instante del montaje.
  const autoFocusInput = typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-16 sm:pt-24 animate-backdrop-in">
      <div className="absolute inset-0" onClick={onClose} />
      {/* Fila de dos tarjetas independientes — el modal principal y, aparte,
          el visor de vista previa al costado (no anidado adentro): así se
          lee como un panel separado, no como una columna más del modal. */}
      <div className="relative z-10 flex w-full max-w-4xl items-start gap-4">
        <div className="flex w-full flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-neutral-900 text-white shadow-2xl animate-search-modal-in">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <Search size={20} className="shrink-0 text-white/50" />
          <input
            autoFocus={autoFocusInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Bikers, eventos, pedidos, fotos, páginas…"
            className="w-full bg-transparent text-base outline-none placeholder:text-white/40"
          />
          <AnimateIcon animateOnHover asChild>
            <button onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
              <X size={16} />
            </button>
          </AnimateIcon>
        </div>

        {!query.trim() && visibleRecents.length > 0 && (
          <div ref={recentsRowRef} className="flex flex-nowrap items-center gap-2 overflow-hidden whitespace-nowrap border-b border-white/10 px-5 py-3">
            <span className="mr-1 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-white/40">Recientes</span>
            {visibleRecents.map((r) => (
              <button
                key={`${r.category}-${r.id}`}
                onClick={() => selectResult(r)}
                className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/20"
              >
                {r.title}
              </button>
            ))}
          </div>
        )}

        {/* Móvil: pestañas subrayadas justificadas al ancho del modal — 4
            fijas (Todo/Bikers/Eventos/Pedidos, sin scroll ni chips), mismo
            lenguaje visual que las pestañas de Configuración/editor de
            evento (borde inferior activo) en vez de píldoras. Escritorio:
            barra vertical a la izquierda, incluye todas las categorías. */}
        <nav className="grid grid-cols-4 border-b border-white/10 sm:hidden">
          <button
            onClick={() => setActiveCategory('todos')}
            className={cn(
              'min-w-0 truncate border-b-2 px-2 py-3 text-sm font-medium transition-colors',
              activeCategory === 'todos' ? 'border-white font-bold text-white' : 'border-transparent text-white/50 hover:text-white',
            )}
          >
            Todo ({totalCount})
          </button>
          {mobileCategoryOrder.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'min-w-0 truncate border-b-2 px-2 py-3 text-sm font-medium transition-colors',
                activeCategory === cat ? 'border-white font-bold text-white' : 'border-transparent text-white/50 hover:text-white',
              )}
            >
              {CATEGORY_LABELS[cat]} ({resultsByCategory[cat].length})
            </button>
          ))}
        </nav>

        <div className="flex max-h-[60vh] flex-1 overflow-hidden">
          <nav className="hidden w-32 shrink-0 flex-col gap-1 overflow-y-auto border-r border-white/10 p-3 sm:flex sm:w-40">
            <button
              onClick={() => setActiveCategory('todos')}
              className={cn(
                'rounded-xl border-l-2 px-3 py-2 text-left text-sm font-medium transition-colors',
                activeCategory === 'todos' ? 'border-white bg-white/10 font-bold text-white' : 'border-transparent text-white/60 hover:text-white',
              )}
            >
              Todos <span className="text-white/40">({totalCount})</span>
            </button>
            {categoryOrder.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'rounded-xl border-l-2 px-3 py-2 text-left text-sm font-medium transition-colors',
                  activeCategory === cat ? 'border-white bg-white/10 font-bold text-white' : 'border-transparent text-white/60 hover:text-white',
                )}
              >
                {CATEGORY_LABELS[cat]} <span className="text-white/40">({resultsByCategory[cat].length})</span>
              </button>
            ))}
          </nav>

          {/* Resultados */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {searchingPhotos && query.trim().length >= 2 && <p className="px-3 py-1 text-xs text-white/40">Buscando fotos…</p>}
            {totalCount === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-white/50">
                {query.trim() ? 'Sin resultados para esa búsqueda.' : 'Escribe para buscar en todo el sitio.'}
              </p>
            ) : (
              visibleCategories.map((cat) => {
                const list = resultsByCategory[cat]
                if (list.length === 0) return null
                return (
                  <div key={cat} className="mb-2">
                    {activeCategory === 'todos' && <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">{CATEGORY_LABELS[cat]}</p>}
                    {list.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => selectResult(r)}
                        onMouseEnter={() => setHovered(r)}
                        className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/10', hovered?.id === r.id && hovered.category === r.category && 'bg-white/10')}
                      >
                        <ResultThumb r={r} className="h-9 w-9 shrink-0 rounded-xl" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white">{r.title}</span>
                          {r.subtitle && <span className="block truncate text-xs text-white/50">{r.subtitle}</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              })
            )}
          </div>

        </div>
      </div>

      {/* Visor de vista previa — EXTERNO al modal a propósito (una tarjeta
          separada al costado, no una columna interna) para que se lea como
          un panel aparte, igual que en la referencia. Solo en pantallas
          anchas; en angostas no hay espacio para un panel al costado. */}
      <div className="hidden w-64 shrink-0 flex-col rounded-3xl border border-white/10 bg-neutral-900 p-4 text-white shadow-2xl animate-search-modal-in sm:flex">
        {hovered ? (
          <>
            <ResultThumb r={hovered} className="aspect-square w-full rounded-2xl text-3xl" />
            <p className="mt-3 truncate text-sm font-semibold text-white">{hovered.title}</p>
            {hovered.subtitle && <p className="truncate text-xs text-white/50">{hovered.subtitle}</p>}
            <p className="mt-auto pt-3 text-[11px] font-semibold uppercase tracking-wide text-white/30">{CATEGORY_LABELS[hovered.category]}</p>
          </>
        ) : (
          <p className="text-xs text-white/40">Pasa el cursor sobre un resultado para verlo aquí.</p>
        )}
      </div>
      </div>
    </div>,
    getPortalRoot(),
  )
}
