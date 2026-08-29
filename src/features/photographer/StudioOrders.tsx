import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePhotographerOrders, type OrderItemStatus } from './useMyOrders'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { cn } from '../../lib/cn'

const ORDER_STATUS_LABEL: Record<OrderItemStatus, string> = {
  pendiente_pago: 'Pendiente de pago',
  activo: 'En proceso',
  finalizado: 'Finalizado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

const TABS: { value: OrderItemStatus | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendiente_pago', label: 'Pendientes de pago' },
  { value: 'activo', label: 'En proceso' },
  { value: 'finalizado', label: 'Finalizados' },
  { value: 'entregado', label: 'Entregados' },
]

export function StudioOrders() {
  const { user } = useAuth()
  const { data: orders = [], isLoading } = usePhotographerOrders(user?.id)
  const [tab, setTab] = useState<OrderItemStatus | 'todos'>('todos')
  const filtered = tab === 'todos' ? orders : orders.filter((o) => o.status === tab)

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 text-foreground md:px-16">
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
            className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-muted"
          >
            <InitialsAvatar name={order.bikerName} className="h-10 w-10 shrink-0 bg-foreground text-sm text-background" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{order.bikerName}</p>
              <p className="truncate text-sm text-muted-foreground">{order.eventTitle} · {order.items.length} fotos</p>
            </div>
            <span className="font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground">
              {new Date(order.createdAt).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })}
            </span>
            <span className="w-36 shrink-0 text-right font-studio-mono text-xs uppercase tracking-wider2">
              {ORDER_STATUS_LABEL[order.status]}
            </span>
            <span className="w-16 shrink-0 text-right font-bold">Q{order.total}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
