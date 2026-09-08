import { useEffect, useMemo, useState } from 'react'
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
import { IconSearch, IconClose, IconImages, IconCart, IconUser, IconArchive, IconCreditCard, IconSettings, IconPlus } from '../../../ui/shared/icons'
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

const STATIC_PAGES: { id: string; title: string; subtitle: string; to: string; icon: React.ReactNode }[] = [
  { id: 'p-eventos', title: 'Eventos', subtitle: 'Ver todos tus eventos', to: '/studio/eventos', icon: <IconImages className="h-4 w-4" /> },
  { id: 'p-crear-evento', title: 'Crear evento', subtitle: 'Publicar un nuevo evento', to: '/studio/eventos/new', icon: <IconPlus className="h-4 w-4" /> },
  { id: 'p-pedidos', title: 'Pedidos', subtitle: 'Ver pedidos de bikers', to: '/studio/pedidos', icon: <IconCart className="h-4 w-4" /> },
  { id: 'p-almacenamiento', title: 'Almacenamiento', subtitle: 'Administrar espacio y limpieza', to: '/studio/almacenamiento', icon: <IconArchive className="h-4 w-4" /> },
  { id: 'p-planes', title: 'Planes', subtitle: 'Planes y facturación', to: '/studio/planes', icon: <IconCreditCard className="h-4 w-4" /> },
  { id: 'p-perfil', title: 'Mi perfil', subtitle: 'Editar tu perfil público', to: '/studio/perfil', icon: <IconUser className="h-4 w-4" /> },
  { id: 'p-ajustes', title: 'Configuración', subtitle: 'Ajustes de tu cuenta', to: '/studio/ajustes', icon: <IconSettings className="h-4 w-4" /> },
]

/** Búsqueda global del portal del fotógrafo — bikers, eventos, pedidos,
 * fotos (por nombre de archivo) y páginas/funciones, todo desde un mismo
 * cuadro. Bikers/eventos/pedidos/páginas se filtran en el cliente sobre
 * datos ya cargados por otros hooks (sin pegarle a la base de datos otra
 * vez); fotos es la única categoría con su propia consulta (debounced),
 * porque buscar por nombre de archivo entre miles de fotos no tiene sentido
 * traerlo completo al cliente de antemano. */
export function GlobalSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<'todos' | SearchCategory>('todos')
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
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveCategory('todos')
      setPhotoResults([])
    }
  }, [open])

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

  const groups = useMemo(() => {
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

    const all: Record<SearchCategory, SearchResult[]> = {
      bikers: rBikers,
      eventos: rEventos,
      pedidos: rPedidos,
      fotos: photoResults,
      paginas: rPaginas,
    }
    if (activeCategory !== 'todos') {
      return { [activeCategory]: all[activeCategory] } as Partial<Record<SearchCategory, SearchResult[]>>
    }
    return all
  }, [query, events, orders, bikers, photoResults, activeCategory])

  const totalCount = Object.values(groups).reduce((s, list) => s + (list?.length ?? 0), 0)
  const categoryCounts: Record<SearchCategory, number> = {
    bikers: bikers.filter((b) => !query.trim() || b.name.toLowerCase().includes(query.trim().toLowerCase())).length,
    eventos: events.filter((e) => !query.trim() || e.title.toLowerCase().includes(query.trim().toLowerCase()) || e.city.toLowerCase().includes(query.trim().toLowerCase())).length,
    pedidos: orders.filter((o) => !query.trim() || o.bikerName.toLowerCase().includes(query.trim().toLowerCase()) || o.eventTitle.toLowerCase().includes(query.trim().toLowerCase())).length,
    fotos: photoResults.length,
    paginas: STATIC_PAGES.filter((p) => !query.trim() || p.title.toLowerCase().includes(query.trim().toLowerCase())).length,
  }

  function go(to: string) {
    onClose()
    navigate(to)
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-16 sm:pt-24">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-neutral-900 text-white shadow-2xl animate-menu-in">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <IconSearch className="h-5 w-5 shrink-0 text-white/50" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Bikers, eventos, pedidos, fotos, páginas…"
            className="w-full bg-transparent text-base outline-none placeholder:text-white/40"
          />
          <button onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto border-b border-white/10 px-5 py-3">
          <button
            onClick={() => setActiveCategory('todos')}
            className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors', activeCategory === 'todos' ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/20')}
          >
            Todos
          </button>
          {(Object.keys(CATEGORY_LABELS) as SearchCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                activeCategory === cat ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/20',
              )}
            >
              {CATEGORY_LABELS[cat]} ({categoryCounts[cat]})
            </button>
          ))}
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
          {searchingPhotos && query.trim().length >= 2 && (
            <p className="px-3 py-1 text-xs text-white/40">Buscando fotos…</p>
          )}
          {totalCount === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-white/50">
              {query.trim() ? 'Sin resultados para esa búsqueda.' : 'Escribe para buscar en todo el sitio.'}
            </p>
          ) : (
            (Object.keys(groups) as SearchCategory[]).map((cat) => {
              const list = groups[cat]
              if (!list || list.length === 0) return null
              return (
                <div key={cat} className="mb-2">
                  <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">{CATEGORY_LABELS[cat]}</p>
                  {list.map((r) => (
                    <button key={r.id} onClick={() => go(r.to)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/10">
                      {r.thumbnail ? (
                        <img src={r.thumbnail} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
                      ) : r.icon ? (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">{r.icon}</span>
                      ) : r.category === 'bikers' ? (
                        <InitialsAvatar name={r.title} className="h-9 w-9 shrink-0 bg-white/10 text-xs text-white" />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xs">•</span>
                      )}
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
