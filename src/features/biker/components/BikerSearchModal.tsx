import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useMyOrders } from '../useMyOrders'
import { usePublicEvents, useApprovedPhotographers } from '../usePublicData'
import { useRoutes } from '../../shared/useRoutes'
import { r2Url } from '../../../lib/r2'
import { formatOrderCode } from '../../../lib/orderStatus'
import { getPortalRoot } from '../../../ui/shared/portalRoot'
import { useScrollLock } from '../../../ui/shared/useScrollLock'
import { InitialsAvatar } from '../../../ui/shared/InitialsAvatar'
import { IconCart, IconMap } from '../../../ui/shared/icons'
import { AnimateIcon } from '../../../ui/animate-icons/icon'
import { Search } from '../../../ui/animate-icons/icons/Search'
import { X } from '../../../ui/animate-icons/icons/X'
import { cn } from '../../../lib/cn'

type SearchCategory = 'pedidos' | 'eventos' | 'fotografos' | 'rutas'

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
  pedidos: 'Pedidos',
  eventos: 'Eventos',
  fotografos: 'Fotógrafos',
  rutas: 'Rutas',
}

const RECENTS_KEY = 'motoshots_biker_recent_searches'
const MAX_RECENTS = 8

function loadRecents(): SearchResult[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

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

function ResultThumb({ r, className }: { r: SearchResult; className: string }) {
  if (r.thumbnail) return <img src={r.thumbnail} alt="" className={cn(className, 'object-cover')} />
  if (r.category === 'fotografos') return <InitialsAvatar name={r.title} className={cn(className, 'bg-white/10 text-white')} />
  if (r.icon) return <span className={cn(className, 'flex items-center justify-center bg-white/10')}>{r.icon}</span>
  return <span className={cn(className, 'flex items-center justify-center bg-white/10 text-xs')}>•</span>
}

/** Búsqueda global del portal del biker — a propósito MUCHO más acotada que
 * `GlobalSearchModal.tsx` del lado del fotógrafo (que incluye fotos por
 * nombre de archivo y páginas/funciones internas): un biker solo puede
 * buscar sus propios pedidos, eventos, fotógrafos y rutas — nunca fotos
 * ajenas por nombre de archivo (decisión explícita del usuario, no un
 * recorte por flojera). Mismo lenguaje visual (modal oscuro, recientes,
 * pestañas por categoría) para que la experiencia se sienta consistente
 * entre portales aunque el alcance sea distinto. */
export function BikerSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<'todos' | SearchCategory>('todos')
  const [recents, setRecents] = useState<SearchResult[]>([])
  const [visibleRecents, setVisibleRecents] = useState<SearchResult[]>([])
  const recentsRowRef = useRef<HTMLDivElement>(null)
  const { data: orders = [] } = useMyOrders(user?.id)
  const { data: events = [] } = usePublicEvents()
  const { data: photographers = [] } = useApprovedPhotographers()
  const { data: routes = [] } = useRoutes()

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // `overflow:hidden` en html/body (el intento anterior) no bastaba en todo
  // dispositivo/navegador — el "rubber-band"/overscroll seguía moviendo la
  // página de fondo detrás del overlay. `useScrollLock` fija el body en su
  // lugar en vez de solo esconder su scrollbar (ver el comentario del hook).
  useScrollLock(open)

  useEffect(() => {
    if (open) {
      setRecents(loadRecents())
    } else {
      setQuery('')
      setActiveCategory('todos')
    }
  }, [open])

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

  const resultsByCategory = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = (s: string) => !q || s.toLowerCase().includes(q)

    const rPedidos: SearchResult[] = orders
      .filter((o) => {
        const eventTitle = o.order_items[0]?.event?.title ?? ''
        const photographerName = o.order_items[0]?.photographer?.display_name ?? ''
        return matches(eventTitle) || matches(photographerName) || matches(String(o.order_number ?? ''))
      })
      .map((o) => ({
        id: o.id,
        category: 'pedidos' as const,
        title: formatOrderCode(o.order_number),
        subtitle: `${o.order_items[0]?.event?.title ?? ''} · ${o.order_items[0]?.photographer?.display_name ?? ''}`,
        to: `/app/historial/${o.id}`,
        icon: <IconCart className="h-4 w-4" />,
      }))

    const rEventos: SearchResult[] = events
      .filter((e) => matches(e.title) || matches(e.city))
      .map((e) => ({
        id: e.id,
        category: 'eventos' as const,
        title: e.title,
        subtitle: `${e.city} · ${e.photographer?.display_name ?? ''}`,
        to: `/app/eventos/${e.id}`,
        thumbnail: e.cover_path ? r2Url(e.cover_path) : null,
      }))

    const rFotografos: SearchResult[] = photographers
      .filter((p) => matches(p.display_name) || matches(p.city ?? ''))
      .map((p) => ({
        id: p.id,
        category: 'fotografos' as const,
        title: p.display_name,
        subtitle: p.city ?? 'Fotógrafo',
        to: `/app/fotografos/${p.id}`,
        thumbnail: p.avatar_url ? (p.avatar_url.startsWith('http') ? p.avatar_url : r2Url(p.avatar_url)) : null,
      }))

    const rRutas: SearchResult[] = routes
      .filter((r) => matches(r.name))
      .map((r) => ({
        id: r.id,
        category: 'rutas' as const,
        title: r.name,
        subtitle: 'Ver en el mapa',
        to: `/app/mapa?ruta=${r.id}`,
        icon: <IconMap className="h-4 w-4" />,
      }))

    return { pedidos: rPedidos, eventos: rEventos, fotografos: rFotografos, rutas: rRutas } as Record<SearchCategory, SearchResult[]>
  }, [query, orders, events, photographers, routes])

  const categoryOrder: SearchCategory[] = ['pedidos', 'eventos', 'fotografos', 'rutas']
  const totalCount = categoryOrder.reduce((s, c) => s + resultsByCategory[c].length, 0)
  const visibleCategories = activeCategory === 'todos' ? categoryOrder : [activeCategory]

  function selectResult(r: SearchResult) {
    saveRecent(r)
    onClose()
    navigate(r.to)
  }

  if (!open) return null

  // En móvil el teclado no debe abrirse solo — el usuario lo activa al
  // tocar el campo (mismo criterio que GlobalSearchModal).
  const autoFocusInput = typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-16 sm:pt-24 animate-backdrop-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-neutral-900 text-white shadow-2xl animate-search-modal-in">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <Search size={20} className="shrink-0 text-white/50" />
          <input
            autoFocus={autoFocusInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tus pedidos, eventos, fotógrafos, rutas…"
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

        {/* Pestañas subrayadas justificadas al ancho del modal — 5 en total
            (Todo + las 4 categorías), mismo lenguaje visual que
            Configuración/editor de evento, en vez de píldoras. */}
        <nav className="grid grid-cols-5 border-b border-white/10">
          <button
            onClick={() => setActiveCategory('todos')}
            className={cn(
              'min-w-0 truncate border-b-2 px-1 py-3 text-xs font-medium transition-colors',
              activeCategory === 'todos' ? 'border-white font-bold text-white' : 'border-transparent text-white/50 hover:text-white',
            )}
          >
            Todo ({totalCount})
          </button>
          {categoryOrder.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'min-w-0 truncate border-b-2 px-1 py-3 text-xs font-medium transition-colors',
                activeCategory === cat ? 'border-white font-bold text-white' : 'border-transparent text-white/50 hover:text-white',
              )}
            >
              {CATEGORY_LABELS[cat]} ({resultsByCategory[cat].length})
            </button>
          ))}
        </nav>

        <div className="max-h-[60vh] flex-1 overflow-y-auto px-2 py-2">
          {totalCount === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-white/50">
              {query.trim() ? 'Sin resultados para esa búsqueda.' : 'Escribe para buscar en tus pedidos, eventos, fotógrafos o rutas.'}
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
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/10"
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
    </div>,
    getPortalRoot(),
  )
}
