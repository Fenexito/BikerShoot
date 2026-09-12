import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePhotographerOrders, type PhotographerOrderGroup } from './useMyOrders'
import { usePhotographerDetails } from './usePhotographerDetails'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { useToastStore } from '../../ui/overlays/toastStore'
import { getPhotographerStatusStyle, formatOrderCode, type OrderItemStatus } from '../../lib/orderStatus'
import { StatusPill } from '../../ui/shared/StatusPill'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { FilterBar } from '../../ui/shared/FilterBar'
import { previewUrl } from '../../lib/r2'
import { cn } from '../../lib/cn'
import { SkeletonRows } from '../../ui/shared/Skeleton'

const PAGE_SIZE_FIRST = 10
const PAGE_SIZE_MORE = 15

function daysSince(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000
}

/** Escala de color según cuánto lleva un pedido sin avanzar — para que un
 * pendiente de pago o en preparación de hace varios días salte a la vista
 * en vez de perderse entre el resto. */
function urgencyClass(order: PhotographerOrderGroup) {
  if (order.status !== 'pendiente_pago' && order.status !== 'en_preparacion') return null
  const days = daysSince(order.createdAt)
  if (days > 3) return 'text-red-500 font-semibold'
  if (days > 1) return 'text-amber-500 font-medium'
  return null
}

// El más reciente arriba, el más antiguo abajo, dentro de cada categoría
// (antes ordenaba por número de pedido ascendente — el más VIEJO quedaba
// primero, al revés de lo esperado).
function byMostRecent(a: PhotographerOrderGroup, b: PhotographerOrderGroup) {
  return +new Date(b.createdAt) - +new Date(a.createdAt)
}

/** Coincide por biker, evento, o número de pedido — con o sin "#" y sin
 * importar los ceros a la izquierda (el fotógrafo puede escribir "123",
 * "000123" o "#000123" y debe encontrarlo igual). */
function orderMatchesQuery(o: PhotographerOrderGroup, q: string) {
  if (!q) return true
  if (o.bikerName.toLowerCase().includes(q) || o.eventTitle.toLowerCase().includes(q)) return true
  if (o.orderNumber == null) return false
  const qDigits = q.replace(/^#/, '').replace(/^0+(?=\d)/, '')
  const orderDigits = String(o.orderNumber)
  return qDigits.length > 0 && orderDigits.includes(qDigits)
}

export function OrderRow({
  order,
  profileName,
  canSelect,
  selected,
  onToggleSelect,
}: {
  order: PhotographerOrderGroup
  profileName?: string
  canSelect: boolean
  selected: boolean
  onToggleSelect: () => void
}) {
  const urgent = urgencyClass(order)
  // Colores desde el punto de vista del fotógrafo — "Subir Comprobante" no
  // es su responsabilidad (no se resalta, azul informativo); "Confirmar
  // Pago" sí lo es (rojo, se resalta). Ver getPhotographerStatusStyle.
  const statusStyle = getPhotographerStatusStyle(order.effectiveStatus)
  const borderColor = statusStyle.highlight ? statusStyle.dot.replace('bg-', 'border-') : undefined

  const activeItems = order.items.filter((i) => i.status !== 'cancelado')
  const deliveredCount = activeItems.filter((i) => i.status === 'entregado').length
  // Barra de progreso de entrega — solo mientras el pedido está en
  // preparación, para que el fotógrafo vea de un vistazo cuánto le falta
  // sin tener que abrir cada pedido uno por uno.
  const showProgress = order.status === 'en_preparacion' && activeItems.length > 0
  // Mismo estilo que "Mis compras" del biker: hasta 3 miniaturas de
  // referencia (fotos DEL PEDIDO, no del comprador) + "+N" si hay más.
  const previewItems = order.items.slice(0, 3)
  const extraCount = order.items.length - previewItems.length

  return (
    <div
      className={cn(
        'flex items-stretch gap-x-4 gap-y-2 rounded-3xl border-l-4 border-y border-r border-border bg-card p-3 transition-all hover:shadow-sm sm:p-3.5',
        borderColor,
      )}
    >
      {canSelect && (
        <button
          onClick={onToggleSelect}
          aria-label="Seleccionar pedido"
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center self-center rounded-full border-2 text-xs font-bold transition-colors',
            selected ? 'border-foreground bg-foreground text-background' : 'border-border text-transparent hover:border-foreground/40',
          )}
        >
          ✓
        </button>
      )}
      <Link to={`/studio/pedidos/${order.orderId}`} className="flex min-w-0 flex-1 items-stretch gap-3 sm:gap-4">
        {/* Miniaturas — la altura se estira para llenar lo que ocupe el
            texto de la derecha, tope de `max-h-24`. */}
        <div className="flex shrink-0 -space-x-4">
          {previewItems.map((item) => (
            <img
              key={item.id}
              src={previewUrl({ storage_path: item.photo?.storage_path ?? null, preview_path: item.photo?.preview_path ?? null })}
              alt=""
              className="aspect-square h-full max-h-24 rounded-xl border-2 border-card object-cover"
            />
          ))}
          {extraCount > 0 && (
            <span className="flex aspect-square h-full max-h-24 items-center justify-center rounded-xl border-2 border-card bg-muted text-xs font-bold text-muted-foreground">
              +{extraCount}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <div className="flex min-w-0 items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{order.bikerName}</p>
                <StatusPill dot={statusStyle.dot} text={statusStyle.text} label={statusStyle.label} className="text-xs font-bold" />
              </div>
              {/* El nombre del evento se oculta en móvil — ahí solo se
                  conserva lo esencial (comprador, foto, estado, # de
                  pedido, cantidad de fotos, fecha y total); en escritorio
                  hay espacio de sobra para mostrarlo también. */}
              <p className="truncate text-sm text-muted-foreground">
                {formatOrderCode(order.orderNumber, profileName)} · <span className="hidden sm:inline">{order.eventTitle} · </span>{order.items.length} fotos
              </p>
              <p className={cn('text-xs', urgent ?? 'text-muted-foreground')}>
                {new Date(order.createdAt).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <span className="shrink-0 self-center rounded-full bg-muted px-3 py-1 text-sm font-bold">Q{order.total}</span>
          </div>
          {showProgress && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${(deliveredCount / activeItems.length) * 100}%` }} />
              </div>
              <span className="shrink-0 text-[11px] font-medium text-muted-foreground">{deliveredCount}/{activeItems.length} entregadas</span>
            </div>
          )}
        </div>
      </Link>
    </div>
  )
}

interface OrderCategory {
  key: string
  label: string
  orders: PhotographerOrderGroup[]
  defaultOpen: boolean
  tone?: 'danger'
}

/** Una categoría de pedidos (urgentes, o un estado) — colapsable, ordenada
 * por número de pedido, con paginación propia: primero 10, "ver más" trae
 * 15 a la vez. Se oculta sola si no tiene ningún pedido (ej. sin
 * cancelados, sin resultados de búsqueda en ese estado). */
function CategorySection({ category, profileName, selectedIds, onToggleSelect }: {
  category: OrderCategory
  profileName?: string
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(category.defaultOpen)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE_FIRST)

  if (category.orders.length === 0) return null

  const visible = category.orders.slice(0, visibleCount)
  const remaining = category.orders.length - visible.length

  return (
    <div id={`pedidos-cat-${category.key}`} className="scroll-mt-28">
      <button onClick={() => setOpen((o) => !o)} className="mb-3 flex w-full items-center justify-between gap-2 text-left">
        <h2 className={cn('flex items-center gap-2 text-sm font-bold uppercase tracking-wide', category.tone === 'danger' ? 'text-red-500' : 'text-muted-foreground')}>
          {category.label}
          <span className={cn('rounded-full px-2 py-0.5 text-xs', category.tone === 'danger' ? 'bg-red-500/10' : 'bg-muted')}>{category.orders.length}</span>
        </h2>
        <span className={cn('text-xs text-muted-foreground transition-transform', open && 'rotate-180')}>▾</span>
      </button>
      {open && (
        <div className="flex flex-col gap-3">
          {visible.map((order, i) => (
            <div key={order.orderId} className="animate-row-in" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
              <OrderRow
                order={order}
                profileName={profileName}
                canSelect={order.status === 'pendiente_pago'}
                selected={selectedIds.has(order.orderId)}
                onToggleSelect={() => onToggleSelect(order.orderId)}
              />
            </div>
          ))}
          {remaining > 0 && (
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE_MORE)}
              className="w-full rounded-2xl border border-border py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
            >
              Ver más ({remaining} más)
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function StudioOrders() {
  const { user, profile } = useAuth()
  const { data: details } = usePhotographerDetails(user?.id)
  const orderCodeName = details?.order_nickname ?? profile?.display_name
  const { data: orders = [], isLoading } = usePhotographerOrders(user?.id)
  const push = useToastStore((s) => s.push)
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'todos' | 'entregado' | 'en_proceso' | 'urgente' | 'pendiente_pago' | 'en_preparacion' | 'cancelado'>('todos')

  // Ya no se filtra por un solo estado a la vez — todos los pedidos se ven
  // siempre, agrupados por categoría (colapsables, con su propia
  // paginación). La búsqueda sigue aplicando dentro de cada categoría.
  const categories = useMemo((): OrderCategory[] => {
    const q = query.trim().toLowerCase()
    const matches = (o: PhotographerOrderGroup) => orderMatchesQuery(o, q)
    const byStatus = (status: OrderItemStatus) => orders.filter((o) => o.status === status && matches(o)).sort(byMostRecent)
    return [
      { key: 'urgente', label: '🔥 Urgentes', orders: orders.filter((o) => urgencyClass(o) !== null && matches(o)).sort(byMostRecent), defaultOpen: true, tone: 'danger' },
      { key: 'pendiente_pago', label: 'Pendientes de pago', orders: byStatus('pendiente_pago'), defaultOpen: true },
      { key: 'en_preparacion', label: 'En preparación', orders: byStatus('en_preparacion'), defaultOpen: true },
      { key: 'entregado', label: 'Entregados', orders: byStatus('entregado'), defaultOpen: true },
      { key: 'cancelado', label: 'Cancelados', orders: byStatus('cancelado'), defaultOpen: false },
    ]
  }, [orders, query])

  const matchingCount = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return orders.length
    return orders.filter((o) => orderMatchesQuery(o, q)).length
  }, [orders, query])

  // El switch/pestañas de la barra de filtro sí filtran de verdad: reducen
  // qué categorías se muestran abajo (no solo saltan a ellas con scroll).
  const visibleCategories = useMemo(() => {
    if (statusFilter === 'todos') return categories
    if (statusFilter === 'en_proceso') return categories.filter((c) => c.key === 'pendiente_pago' || c.key === 'en_preparacion')
    return categories.filter((c) => c.key === statusFilter)
  }, [categories, statusFilter])

  const visibleTotal = useMemo(() => visibleCategories.reduce((s, c) => s + c.orders.length, 0), [visibleCategories])

  const summary = useMemo(() => {
    const collected = orders.filter((o) => o.status === 'entregado' || o.status === 'en_preparacion').reduce((s, o) => s + o.total, 0)
    const pending = orders.filter((o) => o.status === 'pendiente_pago').reduce((s, o) => s + o.total, 0)
    const urgent = orders.filter((o) => urgencyClass(o) !== null).length
    return { collected, pending, urgent }
  }, [orders])

  function toggleSelect(orderId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  async function bulkConfirmPayment() {
    if (!user) return
    setConfirming(true)
    const ids = Array.from(selectedIds)
    const { error } = await supabase
      .from('order_items')
      .update({ status: 'en_preparacion' })
      .in('order_id', ids)
      .eq('photographer_id', user.id)
    setConfirming(false)
    if (error) {
      push({ type: 'error', title: 'No se pudo confirmar', description: error.message })
      return
    }
    push({ type: 'success', title: `${ids.length} pedido${ids.length > 1 ? 's' : ''} confirmado${ids.length > 1 ? 's' : ''}` })
    setSelectedIds(new Set())
    queryClient.invalidateQueries({ queryKey: ['photographer-order-items', user.id] })
  }

  return (
    <div className={STUDIO_PAGE_WIDE}>
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Pedidos</h1>
      <p className="mt-2 text-muted-foreground">{orders.length} pedidos en total</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Cobrado (activo)</p>
          <p className="mt-1 text-2xl font-bold">Q{summary.collected}</p>
        </div>
        <div className="hidden rounded-3xl border border-border bg-card p-5 sm:block">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pendiente por cobrar</p>
          <p className="mt-1 text-2xl font-bold">Q{summary.pending}</p>
        </div>
        <div className={cn('rounded-3xl border p-5', summary.urgent > 0 ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-card')}>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Necesitan atención</p>
          <p className={cn('mt-1 text-2xl font-bold', summary.urgent > 0 && 'text-red-500')}>{summary.urgent}</p>
        </div>
      </div>

      {/* Mismo FilterBar en todas las resoluciones (igual que
          Eventos) — antes móvil tenía un botón+modal aparte, que se veía y
          se sentía distinto a la barra de escritorio. Todas las opciones
          en una sola fila de pestañas (ya no switch + tabs por separado). */}
      <div className="mt-8">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          tabs={[
            { value: 'todos', label: 'Todos' },
            { value: 'urgente', label: 'Urgentes' },
            { value: 'en_proceso', label: 'En proceso' },
            { value: 'entregado', label: 'Entregados' },
            { value: 'cancelado', label: 'Cancelados' },
          ]}
          tabValue={statusFilter}
          onTabChange={(v) => setStatusFilter(v as typeof statusFilter)}
        />
      </div>

      {isLoading && <SkeletonRows count={5} className="mt-6" />}

      {!isLoading && (matchingCount === 0 || visibleTotal === 0) && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
          <span className="text-4xl opacity-40">🧾</span>
          <p className="font-semibold">
            {orders.length === 0 ? 'Todavía no tienes pedidos' : matchingCount === 0 ? 'Ningún pedido coincide con esa búsqueda' : 'Ningún pedido coincide con ese filtro'}
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-8 pb-20">
        {visibleCategories.map((category) => (
          <CategorySection key={category.key} category={category} profileName={orderCodeName} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 md:bottom-6">
          <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-border bg-background px-5 py-3 shadow-lg">
            <span className="text-sm font-semibold">{selectedIds.size} seleccionado{selectedIds.size > 1 ? 's' : ''}</span>
            <button
              onClick={bulkConfirmPayment}
              disabled={confirming}
              className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {confirming ? 'Confirmando…' : 'Confirmar pago recibido'}
            </button>
            <button onClick={() => setSelectedIds(new Set())} aria-label="Cancelar selección" className="ml-1 text-muted-foreground hover:text-foreground">
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
