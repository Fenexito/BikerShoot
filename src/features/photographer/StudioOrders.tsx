import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePhotographerOrders, type PhotographerOrderGroup } from './useMyOrders'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { useToastStore } from '../../ui/overlays/toastStore'
import { getOrderStatusStyle, type OrderItemStatus } from '../../lib/orderStatus'
import { StatusPill } from '../../ui/shared/StatusPill'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { IconSearch } from '../../ui/shared/icons'
import { cn } from '../../lib/cn'
import { SkeletonRows } from '../../ui/shared/Skeleton'

const TABS: { value: OrderItemStatus | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendiente_pago', label: 'Pendientes de pago' },
  { value: 'en_preparacion', label: 'En preparación' },
  { value: 'entregado', label: 'Entregados' },
  { value: 'cancelado', label: 'Cancelados' },
]

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

export function StudioOrders() {
  const { user } = useAuth()
  const { data: orders = [], isLoading } = usePhotographerOrders(user?.id)
  const push = useToastStore((s) => s.push)
  const [tab, setTab] = useState<OrderItemStatus | 'todos'>('todos')
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)

  const filtered = useMemo(() => {
    let list = tab === 'todos' ? orders : orders.filter((o) => o.status === tab)
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((o) => o.bikerName.toLowerCase().includes(q) || o.eventTitle.toLowerCase().includes(q))
    return list
  }, [orders, tab, query])

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

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Cobrado (activo)</p>
          <p className="mt-1 text-2xl font-bold">Q{summary.collected}</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pendiente por cobrar</p>
          <p className="mt-1 text-2xl font-bold">Q{summary.pending}</p>
        </div>
        <div className={cn('rounded-3xl border p-5', summary.urgent > 0 ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-card')}>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Necesitan atención</p>
          <p className={cn('mt-1 text-2xl font-bold', summary.urgent > 0 && 'text-red-500')}>{summary.urgent}</p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-full bg-muted px-4 py-2 sm:max-w-xs">
          <IconSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por biker o evento…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const count = t.value === 'todos' ? orders.length : orders.filter((o) => o.status === t.value).length
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={cn(
                  'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors',
                  tab === t.value ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-border hover:text-foreground',
                )}
              >
                {t.label} <span className="opacity-70">({count})</span>
              </button>
            )
          })}
        </div>
      </div>

      {isLoading && <SkeletonRows count={5} className="mt-6" />}

      {!isLoading && filtered.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
          <span className="text-4xl opacity-40">🧾</span>
          <p className="font-semibold">No hay pedidos en esta categoría</p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 pb-20">
        {filtered.map((order) => {
          const urgent = urgencyClass(order)
          const canSelect = order.status === 'pendiente_pago'
          return (
            <div
              key={order.orderId}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-3xl border border-border bg-card px-5 py-4 transition-all hover:border-accent/40 hover:shadow-sm"
            >
              {canSelect && (
                <button
                  onClick={() => toggleSelect(order.orderId)}
                  aria-label="Seleccionar pedido"
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors',
                    selectedIds.has(order.orderId) ? 'border-foreground bg-foreground text-background' : 'border-border text-transparent hover:border-foreground/40',
                  )}
                >
                  ✓
                </button>
              )}
              <Link to={`/studio/pedidos/${order.orderId}`} className="flex min-w-0 flex-1 items-center gap-4">
                <InitialsAvatar name={order.bikerName} className="h-11 w-11 shrink-0 bg-foreground text-sm text-background" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{order.bikerName}</p>
                  <p className="truncate text-sm text-muted-foreground">{order.eventTitle} · {order.items.length} fotos</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <span className={cn('text-xs', urgent ?? 'text-muted-foreground')}>
                    {new Date(order.createdAt).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })}
                  </span>
                  <StatusPill
                    dot={getOrderStatusStyle(order.status).dot}
                    text={getOrderStatusStyle(order.status).text}
                    label={getOrderStatusStyle(order.status).label}
                    className="text-xs"
                  />
                  <span className="rounded-full bg-muted px-3 py-1 text-sm font-bold">Q{order.total}</span>
                </div>
              </Link>
            </div>
          )
        })}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
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
