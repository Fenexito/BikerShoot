import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePhotographerOrders } from './useMyOrders'
import { getOrderStatusStyle, type OrderItemStatus } from '../../lib/orderStatus'
import { StatusPill } from '../../ui/shared/StatusPill'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { cn } from '../../lib/cn'

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

      <div className="mt-8 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => {
          const count = t.value === 'todos' ? orders.length : orders.filter((o) => o.status === t.value).length
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'whitespace-nowrap border-b-2 px-4 py-3 font-studio-mono text-xs uppercase tracking-wider2 transition-colors',
                tab === t.value ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label} ({count})
            </button>
          )
        })}
      </div>

      {isLoading && <p className="mt-10 text-center text-muted-foreground">Cargando…</p>}

      {!isLoading && filtered.length === 0 && (
        <p className="mt-10 text-center text-muted-foreground">No hay pedidos en esta categoría.</p>
      )}

      <div className="mt-6 flex flex-col divide-y divide-border border border-border">
        {filtered.map((order) => (
          <Link
            key={order.orderId}
            to={`/studio/pedidos/${order.orderId}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-muted"
          >
            <InitialsAvatar name={order.bikerName} className="h-10 w-10 shrink-0 bg-foreground text-sm text-background" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{order.bikerName}</p>
              <p className="truncate text-sm text-muted-foreground">{order.eventTitle} · {order.items.length} fotos</p>
            </div>
            <div className="ml-[52px] flex w-full flex-wrap items-center gap-3 sm:ml-0 sm:w-auto sm:justify-end">
              <span className="font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground">
                {new Date(order.createdAt).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })}
              </span>
              <StatusPill
                dot={getOrderStatusStyle(order.status).dot}
                text={getOrderStatusStyle(order.status).text}
                label={getOrderStatusStyle(order.status).label}
                className="font-studio-mono text-xs uppercase tracking-wider2"
              />
              <span className="font-bold">Q{order.total}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
