import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePhotographerOrders } from './useMyOrders'
import { getOrderStatusStyle, type OrderItemStatus } from '../../lib/orderStatus'
import { StatusPill } from '../../ui/shared/StatusPill'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { cn } from '../../lib/cn'
import { SkeletonRows } from '../../ui/shared/Skeleton'

const TABS: { value: OrderItemStatus | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendiente_pago', label: 'Pendientes de pago' },
  { value: 'en_preparacion', label: 'En preparación' },
  { value: 'entregado', label: 'Entregados' },
  { value: 'cancelado', label: 'Cancelados' },
]

export function StudioOrders() {
  const { user } = useAuth()
  const { data: orders = [], isLoading } = usePhotographerOrders(user?.id)
  const [tab, setTab] = useState<OrderItemStatus | 'todos'>('todos')
  const filtered = tab === 'todos' ? orders : orders.filter((o) => o.status === tab)

  return (
    <div className={STUDIO_PAGE_WIDE}>
      <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">Pedidos</h1>
      <p className="mt-2 text-muted-foreground">{orders.length} pedidos en total</p>

      <div className="mt-8 flex flex-wrap gap-2">
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

      {isLoading && <SkeletonRows count={5} className="mt-6" />}

      {!isLoading && filtered.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
          <span className="text-4xl opacity-40">🧾</span>
          <p className="font-semibold">No hay pedidos en esta categoría</p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {filtered.map((order) => (
          <Link
            key={order.orderId}
            to={`/studio/pedidos/${order.orderId}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-3xl border border-border bg-card px-5 py-4 transition-all hover:border-accent/40 hover:shadow-sm"
          >
            <InitialsAvatar name={order.bikerName} className="h-11 w-11 shrink-0 bg-foreground text-sm text-background" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{order.bikerName}</p>
              <p className="truncate text-sm text-muted-foreground">{order.eventTitle} · {order.items.length} fotos</p>
            </div>
            <div className="ml-[60px] flex w-full flex-wrap items-center gap-3 sm:ml-0 sm:w-auto sm:justify-end">
              <span className="text-xs text-muted-foreground">
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
        ))}
      </div>
    </div>
  )
}
