import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMyOrders } from './useMyOrders'
import { PurchasedPhotoTile } from './components/PurchasedPhotoTile'
import { Button } from '../../ui/flat/Button'
import { Badge } from '../../ui/flat/Badge'
import { formatOrderCode } from '../../lib/orderStatus'
import { SkeletonRows } from '../../ui/shared/Skeleton'

export function History() {
  const { user } = useAuth()
  const { data: orders = [], isLoading } = useMyOrders(user?.id)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 font-flat md:px-8">
        <SkeletonRows count={3} />
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-24 text-center font-flat">
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
    <div className="mx-auto max-w-4xl px-4 py-10 font-flat md:px-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">Mis compras</h1>
      <p className="mb-8 text-muted-foreground">{orders.length} pedidos</p>

      <div className="flex flex-col gap-6">
        {orders.map((order) => (
          <Link
            key={order.id}
            to={`/app/historial/${order.id}`}
            className="block rounded-3xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">
                  {formatOrderCode(order.order_number)} · {new Date(order.created_at).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
                <p className="font-bold">Q{order.total} · {order.order_items.length} fotos</p>
              </div>
              <Badge tone="secondary">{order.payment_method === 'tarjeta' ? 'Tarjeta' : 'Transferencia'}</Badge>
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
        ))}
      </div>
    </div>
  )
}
