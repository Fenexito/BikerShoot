import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMyOrders, deriveGroupStatus } from './useMyOrders'
import { PurchasedPhotoTile } from './components/PurchasedPhotoTile'
import { Button } from '../../ui/flat/Button'
import { FancySelect } from '../../ui/shared/FancySelect'
import { FilterBar } from '../../ui/shared/FilterBar'
import { StatusPill } from '../../ui/shared/StatusPill'
import { getOrderStatusStyle, formatOrderCode } from '../../lib/orderStatus'
import { SkeletonRows } from '../../ui/shared/Skeleton'
import { cn } from '../../lib/cn'

type StatusFilter = 'todos' | 'entregado' | 'en_proceso' | 'cancelado'

const STATUS_TABS = [
  { value: 'todos', label: 'Todos' },
  { value: 'entregado', label: 'Completados' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'cancelado', label: 'Cancelados' },
]

/** Mismo lenguaje visual que Pedidos en el portal del fotógrafo — franja
 * de color por estado a la izquierda, resumen en tarjetas arriba, barra
 * de filtros con pestañas + búsqueda, y un select adicional por
 * fotógrafo (un biker puede haber comprado a varios). */
export function History() {
  const { user } = useAuth()
  const { data: orders = [], isLoading } = useMyOrders(user?.id)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('todos')
  const [photographerId, setPhotographerId] = useState('')

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
      .map((o) => ({ order: o, status: deriveGroupStatus(o.order_items) }))
      .filter(({ status: s }) => {
        if (status === 'todos') return true
        if (status === 'en_proceso') return s === 'en_preparacion' || s === 'pendiente_pago'
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

  const summary = useMemo(() => {
    const spent = orders.filter((o) => deriveGroupStatus(o.order_items) !== 'cancelado').reduce((s, o) => s + o.total, 0)
    const pending = orders.filter((o) => deriveGroupStatus(o.order_items) === 'pendiente_pago').reduce((s, o) => s + o.total, 0)
    const inProgress = orders.filter((o) => {
      const s = deriveGroupStatus(o.order_items)
      return s === 'en_preparacion' || s === 'pendiente_pago'
    }).length
    return { spent, pending, inProgress }
  }, [orders])

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

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Gastado (activo)</p>
          <p className="mt-1 text-2xl font-bold">Q{summary.spent}</p>
        </div>
        <div className="hidden rounded-3xl border border-border bg-card p-5 sm:block">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pendiente por pagar</p>
          <p className="mt-1 text-2xl font-bold">Q{summary.pending}</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">En proceso</p>
          <p className="mt-1 text-2xl font-bold">{summary.inProgress}</p>
        </div>
      </div>

      <FilterBar
        className="mb-6"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Buscar por evento, fotógrafo o # de pedido…"
        tabs={STATUS_TABS}
        tabValue={status}
        onTabChange={(v) => setStatus(v as StatusFilter)}
      />

      {photographers.length > 1 && (
        <div className="mb-6">
          <FancySelect
            value={photographerId}
            onChange={setPhotographerId}
            options={photographers}
            placeholder="Todo fotógrafo"
            className="w-56"
          />
        </div>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
          <span className="text-4xl opacity-40">🔍</span>
          <p className="font-semibold">Ningún pedido coincide con ese filtro</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {filtered.map(({ order, status: s }, i) => {
          const statusStyle = getOrderStatusStyle(s)
          const firstItem = order.order_items[0]
          return (
            <Link
              key={order.id}
              to={`/app/historial/${order.id}`}
              className={cn(
                'animate-[fade-in-up_.3s_ease-out_backwards] block rounded-3xl border-l-4 border-y border-r border-border bg-card p-5 transition-colors hover:border-primary/30',
                statusStyle.dot.replace('bg-', 'border-l-'),
              )}
              style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{firstItem?.photographer?.display_name ?? 'Fotógrafo'}</p>
                    <StatusPill dot={statusStyle.dot} text={statusStyle.text} label={statusStyle.label} className="text-xs font-bold" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatOrderCode(order.order_number)} · {firstItem?.event?.title ?? ''} · {new Date(order.created_at).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-sm font-bold">Q{order.total}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {order.order_items.slice(0, 8).map((item) => (
                  <PurchasedPhotoTile key={item.id} photoId={item.photo_id} photo={item.photo} status={item.status} />
                ))}
              </div>
              {order.order_items.length > 8 && (
                <p className="mt-3 text-center text-sm font-semibold text-primary">Ver detalle del pedido →</p>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
