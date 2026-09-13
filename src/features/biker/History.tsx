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
import { IconFilter, IconSearch } from '../../ui/shared/icons'
import { cn } from '../../lib/cn'

type StatusFilter = 'todos' | 'pendiente' | 'en_proceso' | 'entregado' | 'cancelado'

// Mismo orden y mismos nombres que las categorías del portal del
// fotógrafo (Todos/Urgentes solo ahí/Pendientes/En Proceso/
// Entregados-o-Completados/Cancelados) — el biker no tiene "Urgentes" (esa
// urgencia es solo responsabilidad del fotógrafo), y "Completados" es el
// nombre que le corresponde a este lado en vez de "Entregados".
const STATUS_TABS = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'entregado', label: 'Completados' },
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
  // Hasta 3 miniaturas de referencia — si hay más, la última se reemplaza
  // por un "+N" con la cantidad restante (no una miniatura más).
  const previewItems = order.order_items.slice(0, 3)
  const extraCount = order.order_items.length - previewItems.length
  // La barra de progreso del pedido en la LISTA se basa en el TOTAL de
  // fotos compradas (sin importar de cuántos fotógrafos distintos son) —
  // así el biker entiende de un vistazo en qué momento se completa TODO
  // el pedido, no solo la parte de un fotógrafo en particular.
  const activeItems = order.order_items.filter((i) => i.status !== 'cancelado')
  const deliveredCount = activeItems.filter((i) => i.status === 'entregado').length
  const showProgress = (effectiveStatus === 'en_preparacion' || effectiveStatus === 'entrega_parcial') && activeItems.length > 0

  return (
    <Link
      to={`/app/historial/${order.id}`}
      className={cn(
        'animate-[fade-in-up_.3s_ease-out_backwards] flex items-stretch gap-3 rounded-2xl border-l-4 border-y border-r border-border bg-card p-3 transition-colors hover:border-primary/30 sm:gap-4 sm:p-3.5',
        statusStyle.dot.replace('bg-', 'border-l-'),
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      {/* Miniaturas — ANCHO fijo (nunca crece, así nunca empuja el texto),
          alto estirado para llenar lo que ocupe el texto de la derecha
          (tope `max-h-24` para que un pedido con varios fotógrafos
          listados, y por lo tanto muy alto, no infle las miniaturas de
          más). Visibles también en móvil (antes se ocultaban ahí). */}
      <div className="flex shrink-0 -space-x-3">
        {previewItems.map((item) => (
          <img
            key={item.id}
            src={previewUrl({ storage_path: item.photo?.storage_path ?? null, preview_path: item.photo?.preview_path ?? null })}
            alt=""
            className="h-full w-12 max-h-24 shrink-0 rounded-xl border-2 border-card object-cover sm:w-16"
          />
        ))}
        {extraCount > 0 && (
          <span className="flex h-full w-12 max-h-24 shrink-0 items-center justify-center rounded-xl border-2 border-card bg-muted text-xs font-bold text-muted-foreground sm:w-16">
            +{extraCount}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
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
        {showProgress && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${(deliveredCount / activeItems.length) * 100}%` }} />
            </div>
            <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{deliveredCount}/{activeItems.length}</span>
          </div>
        )}
      </div>

      <span className="shrink-0 self-center rounded-full bg-muted px-3 py-1 text-sm font-bold">Q{order.total}</span>
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
        if (status === 'pendiente') return s === 'pendiente_comprobante' || s === 'pendiente_confirmacion'
        if (status === 'en_proceso') return s === 'en_preparacion' || s === 'entrega_parcial'
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

      {/* Tabs en su propia fila arriba (justificadas a todo el ancho en
          móvil, ver FilterBar) — buscador + botón de Filtros SIEMPRE en la
          misma fila debajo, incluso en móvil (antes quedaban en dos filas
          separadas ahí): el buscador toma 3/4 del ancho y Filtros el 1/4
          restante, en vez de apilarse. */}
      <div className="mb-6 flex w-full min-w-0 flex-col gap-3">
        <FilterBar
          className="!border-none !pb-0"
          hideSearch
          searchValue={query}
          onSearchChange={setQuery}
          tabs={STATUS_TABS}
          tabValue={status}
          onTabChange={(v) => setStatus(v as StatusFilter)}
        />
        <div className="flex w-full items-center gap-2">
          <div className={cn('flex min-w-0 items-center gap-2 rounded-full bg-muted px-4 py-2', photographers.length > 1 ? 'flex-[3]' : 'flex-1')}>
            <IconSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por evento, fotógrafo o # de pedido…"
              className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {photographers.length > 1 && (
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className="flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted"
            >
              <IconFilter className="h-4 w-4 shrink-0" />
              <span className="hidden lg:inline">Filtros</span>
              {activeFilterCount > 0 && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">{activeFilterCount}</span>
              )}
            </button>
          )}
        </div>
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
