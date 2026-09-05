import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMyOrders, deriveGroupStatus, type MyOrderItem } from './useMyOrders'
import { PurchasedPhotoTile } from './components/PurchasedPhotoTile'
import { Badge } from '../../ui/flat/Badge'
import { OrderStepper } from '../../ui/studio/OrderStepper'
import { getOrderStatusStyle, formatOrderCode } from '../../lib/orderStatus'
import { PlaceholderPage } from '../auth/PlaceholderPage'
import { Skeleton, SkeletonGrid } from '../../ui/shared/Skeleton'

const FLOW = ['pendiente_pago', 'en_preparacion', 'entregado'] as const
const FLOW_LABELS = FLOW.map((s) => getOrderStatusStyle(s).label)

export function HistoryOrderDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data: orders = [], isLoading } = useMyOrders(user?.id)
  const order = orders.find((o) => o.id === id)

  const photographerGroups = useMemo(() => {
    if (!order) return []
    const map = new Map<string, { photographerName: string; items: MyOrderItem[] }>()
    for (const item of order.order_items) {
      const g = map.get(item.photographer_id) ?? { photographerName: item.photographer?.display_name ?? 'Fotógrafo', items: [] }
      g.items.push(item)
      map.set(item.photographer_id, g)
    }
    return Array.from(map.entries()).map(([photographerId, g]) => ({
      photographerId,
      photographerName: g.photographerName,
      items: g.items,
      subtotal: g.items.reduce((s, i) => s + i.price, 0),
      status: deriveGroupStatus(g.items),
    }))
  }, [order])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 font-flat md:px-8">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="mt-3 h-4 w-1/3" />
        <SkeletonGrid count={6} className="mt-8" />
      </div>
    )
  }

  if (!order) return <PlaceholderPage title="Pedido no encontrado" />

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 font-flat md:px-8">
      <Link to="/app/historial" className="text-sm font-medium text-muted-foreground hover:text-foreground">
        ← Mis compras
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div>
          <p className="text-sm text-muted-foreground">
            {formatOrderCode(order.order_number)} · {new Date(order.created_at).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
          <p className="text-2xl font-bold">Q{order.total}</p>
        </div>
        <Badge tone="secondary">{order.payment_method === 'tarjeta' ? 'Tarjeta' : 'Transferencia'}</Badge>
      </div>

      <div className="mt-8 flex flex-col gap-8">
        {photographerGroups.map((group) => (
          <div key={group.photographerId} className="rounded-3xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <Link to={`/app/fotografos/${group.photographerId}`} className="font-bold hover:underline">
                {group.photographerName}
              </Link>
              <span className="text-sm text-muted-foreground">{group.items.length} foto{group.items.length > 1 ? 's' : ''} · Q{group.subtotal}</span>
            </div>

            {group.status !== 'cancelado' && (
              <OrderStepper steps={FLOW_LABELS} currentIndex={FLOW.indexOf(group.status as (typeof FLOW)[number])} className="mb-6" />
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {group.items.map((item) => (
                <PurchasedPhotoTile key={item.id} photoId={item.photo_id} photo={item.photo} status={item.status} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
