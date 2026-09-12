import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMyOrders, deriveOrderEffectiveStatus, groupOrderByPhotographer, type MyOrder } from './useMyOrders'
import type { EffectiveOrderStatus } from '../../lib/orderStatus'
import { previewUrl } from '../../lib/r2'
import { Button } from '../../ui/flat/Button'
import { FancySelect } from '../../ui/shared/FancySelect'
import { FilterBar } from '../../ui/shared/FilterBar'
import { StatusPill } from '../../ui/shared/StatusPill'
import { getEffectiveStatusStyle, formatOrderCode } from '../../lib/orderStatus'
import { SkeletonRows } from '../../ui/shared/Skeleton'
import { IconFilter } from '../../ui/shared/icons'
import { cn } from '../../lib/cn'

type StatusFilter = 'todos' | 'entregado' | 'en_proceso' | 'cancelado'

const STATUS_TABS = [
  { value: 'todos', label: 'Todos' },
  { value: 'entregado', label: 'Completados' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'cancelado', label: 'Cancelados' },
]

/** Fila compacta por pedido — antes mostraba TODAS las fotos del pedido en
 * una grilla completa, lo que hacía la página abrumadora con muchos
 * pedidos (y esa info ya se repite tal cual en el detalle del pedido). Acá
 * solo hay un par de miniaturas como referencia visual — ver el detalle
 * completo requiere entrar al pedido. */
function OrderRow({ order, effectiveStatus, index }: { order: MyOrder; effectiveStatus: EffectiveOrderStatus; index: number }) {
  const statusStyle = getEffectiveStatusStyle(effectiveStatus)
  const firstItem = order.order_items[0]
  const photographerGroups = groupOrderByPhotographer(order)
  const multiPhotographer = photographerGroups.length > 1
  // Varios eventos pueden colarse en un mismo pedido de dos formas: varios
  // fotógrafos (cada uno de su propio evento) o UN fotógrafo que vendió de
  // dos eventos distintos — en cualquiera de los dos casos, mostrar "el"
  // nombre del evento sería engañoso, así que se oculta.
  const distinctEventTitles = new Set(order.order_items.map((i) => i.event?.title).filter(Boolean))
  // Un par de miniaturas nada más, como referencia visual del pedido — no
  // hace falta más para reconocerlo de un vistazo.
  const previewItems = order.order_items.slice(0, 3)

  return (
    <Link
      to={`/app/historial/${order.id}`}
      className={cn(
        'animate-[fade-in-up_.3s_ease-out_backwards] flex items-center gap-3 rounded-2xl border-l-4 border-y border-r border-border bg-card p-3.5 transition-colors hover:border-primary/30 sm:gap-4 sm:p-4',
        statusStyle.dot.replace('bg-', 'border-l-'),
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      {/* Miniaturas — ocultas en móvil (el espacio se prioriza para la
          info) pero visibles desde `sm:` en escritorio, como un pequeño
          carrusel de referencia (igual de espíritu que la portada de un
          evento). */}
      <div className="hidden shrink-0 -space-x-3 sm:flex">
        {previewItems.map((item) => (
          <img
            key={item.id}
            src={previewUrl({ storage_path: item.photo?.storage_path ?? null, preview_path: item.photo?.preview_path ?? null })}
            alt=""
            className="h-14 w-14 rounded-xl border-2 border-card object-cover"
          />
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex flex-wrap items-center gap-2">
          <StatusPill dot={statusStyle.dot} text={statusStyle.text} label={statusStyle.label} className="text-xs font-bold" />
          <span className="text-xs text-muted-foreground">{formatOrderCode(order.order_number)}</span>
        </div>
        {/* Con varios fotógrafos, en vez de un título genérico "N
            fotógrafos", se listan sus nombres uno por uno (como si el
            pedido tuviera varios "títulos") junto a cuántas fotos le tocan
            a cada uno. */}
        {multiPhotographer ? (
          <div className="flex flex-col gap-0.5">
            {photographerGroups.map((g) => (
              <p key={g.photographerId} className="truncate text-sm font-bold">
                {g.photographerName} <span className="font-normal text-muted-foreground">({g.items.length} foto{g.items.length > 1 ? 's' : ''})</span>
              </p>
            ))}
          </div>
        ) : (
          <p className="truncate font-bold">{firstItem?.photographer?.display_name ?? 'Fotógrafo'}</p>
        )}
        <p className="truncate text-sm text-muted-foreground">
          {distinctEventTitles.size === 1 && <>{Array.from(distinctEventTitles)[0]} · </>}
          {order.order_items.length} foto{order.order_items.length > 1 ? 's' : ''}
        </p>
        <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
      </div>

      <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-sm font-bold">Q{order.total}</span>
    </Link>
  )
}

/** Mismo lenguaje visual que Pedidos en el portal del fotógrafo — franja
 * de color por estado a la izquierda, resumen en tarjetas arriba, barra
 * de filtros con pestañas + búsqueda + botón de filtros (mismo patrón que
 * Eventos), y filas compactas por pedido (el detalle completo vive en la
 * página del pedido, no repetido acá). */
export function History() {
  const { user } = useAuth()
  const { data: orders = [], isLoading } = useMyOrders(user?.id)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('todos')
  const [photographerId, setPhotographerId] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const photographers = useMemo(() => {
    const map = new Map<string, string>()
    for (const o of orders) {
      for (const item of o.order_items) {
        if (item.photographer?.display_name) map.set(item.photographer_id, item.photographer.display_name)
      }
    }
    return [...map.entries()].map(([id, name]) => ({ value: id, label: name }))
  }, [orders])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return orders
      .map((o) => ({ order: o, status: deriveOrderEffectiveStatus(o) }))
      .filter(({ status: s }) => {
        if (status === 'todos') return true
        if (status === 'en_proceso') return s !== 'entregado' && s !== 'cancelado'
        return s === status
      })
      .filter(({ order }) => (photographerId ? order.order_items.some((i) => i.photographer_id === photographerId) : true))
      .filter(({ order }) => {
        if (!q) return true
        const eventTitle = order.order_items[0]?.event?.title ?? ''
        const photographerName = order.order_items[0]?.photographer?.display_name ?? ''
        return eventTitle.toLowerCase().includes(q) || photographerName.toLowerCase().includes(q) || String(order.order_number ?? '').includes(q)
      })
  }, [orders, query, status, photographerId])


  const activeFilterCount = photographerId ? 1 : 0

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-6 font-flat md:px-8 md:py-10">
        <SkeletonRows count={3} />
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-16 text-center font-flat md:py-24">
        <span className="text-5xl">🧾</span>
        <h1 className="text-2xl font-bold tracking-tight">Aún no tienes compras</h1>
        <p className="text-muted-foreground">Cuando compres fotos, las verás aquí listas para descargar.</p>
        <Link to="/app/buscar">
          <Button size="lg" className="mt-4">Buscar fotos</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-3 py-6 font-flat md:px-8 md:py-10">
      <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">Mis compras</h1>
      <p className="mb-6 text-muted-foreground">{orders.length} pedidos</p>

      {/* Misma línea que Eventos: tabs + buscador + botón de Filtros — en
          móvil, tabs en su propia fila (scroll horizontal si hace falta) y
          buscador+filtros en la siguiente, en vez del select suelto de
          fotógrafo que vivía aparte antes. */}
      <div className="mb-6 flex w-full min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <FilterBar
          className="!border-none min-w-0 flex-1 !pb-0"
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar por evento, fotógrafo o # de pedido…"
          tabs={STATUS_TABS}
          tabValue={status}
          onTabChange={(v) => setStatus(v as StatusFilter)}
        />
        {photographers.length > 1 && (
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
          >
            <IconFilter className="h-4 w-4" />
            <span className="hidden lg:inline">Filtros</span>
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">{activeFilterCount}</span>
            )}
          </button>
        )}
      </div>

      {filtersOpen && photographers.length > 1 && (
        <div className="mb-6">
          <FancySelect value={photographerId} onChange={setPhotographerId} options={photographers} placeholder="Todo fotógrafo" className="w-full sm:w-64" />
        </div>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
          <span className="text-4xl opacity-40">🔍</span>
          <p className="font-semibold">Ningún pedido coincide con ese filtro</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map(({ order, status: s }, i) => (
          <OrderRow key={order.id} order={order} effectiveStatus={s} index={i} />
        ))}
      </div>
    </div>
  )
}
