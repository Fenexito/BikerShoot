import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMyOrders, groupOrderByPhotographer } from './useMyOrders'
import { PurchasedPhotoTile } from './components/PurchasedPhotoTile'
import { Badge } from '../../ui/flat/Badge'
import { Button } from '../../ui/flat/Button'
import { StatusPill } from '../../ui/shared/StatusPill'
import { OrderStepper } from '../../ui/studio/OrderStepper'
import { getEffectiveStatusStyle, formatOrderCode, type EffectiveOrderStatus } from '../../lib/orderStatus'
import { PlaceholderPage } from '../auth/PlaceholderPage'
import { Skeleton, SkeletonGrid } from '../../ui/shared/Skeleton'
import { useBackButton } from '../../ui/shared/useBackButton'

// Con transferencia, el flujo pasa primero por "subir comprobante" — con
// tarjeta ese paso no existe (no hay comprobante manual que subir), así
// que el stepper de cada grupo usa uno u otro flujo según el método de
// pago del pedido.
const FLOW_TRANSFERENCIA: EffectiveOrderStatus[] = ['pendiente_comprobante', 'pendiente_confirmacion', 'en_preparacion', 'entregado']
const FLOW_TARJETA: EffectiveOrderStatus[] = ['pendiente_confirmacion', 'en_preparacion', 'entregado']

export function HistoryOrderDetail() {
  const { id } = useParams()
  useBackButton('/app/historial')
  const { user } = useAuth()
  const { data: orders = [], isLoading } = useMyOrders(user?.id)
  const order = orders.find((o) => o.id === id)
  const photographerGroups = order ? groupOrderByPhotographer(order) : []
  const flow = order?.payment_method === 'transferencia' ? FLOW_TRANSFERENCIA : FLOW_TARJETA
  const flowLabels = flow.map((s) => getEffectiveStatusStyle(s).label)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-3 py-6 font-flat md:px-8 md:py-10">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="mt-3 h-4 w-1/3" />
        <SkeletonGrid count={6} className="mt-8" />
      </div>
    )
  }

  if (!order) return <PlaceholderPage title="Pedido no encontrado" />

  return (
    <div className="mx-auto max-w-4xl px-3 py-6 font-flat md:px-8 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div>
          <p className="text-sm text-muted-foreground">
            {formatOrderCode(order.order_number)} · {new Date(order.created_at).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
          <p className="text-2xl font-bold">Q{order.total}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="secondary">{order.payment_method === 'tarjeta' ? 'Tarjeta' : 'Transferencia'}</Badge>
          {/* Si el biker se sale de /app/checkout/pago/:id sin terminar de
              subir sus comprobantes, antes no había ninguna forma de
              volver — este es el camino de regreso, siempre disponible
              desde el pedido mismo, no solo justo después de comprar. */}
          {order.payment_method === 'transferencia' && (
            <Link to={`/app/checkout/pago/${order.id}`}>
              <Button variant="secondary" size="sm">
                Subir comprobantes de pago
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-8">
        {photographerGroups.map((group) => {
          const groupStyle = getEffectiveStatusStyle(group.effectiveStatus)
          return (
          <div key={group.photographerId} className="rounded-3xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/app/fotografos/${group.photographerId}`} className="font-bold hover:underline">
                  {group.photographerName}
                </Link>
                <StatusPill dot={groupStyle.dot} text={groupStyle.text} label={groupStyle.label} className="text-xs" />
              </div>
              <span className="text-sm text-muted-foreground">{group.items.length} foto{group.items.length > 1 ? 's' : ''} · Q{group.subtotal}</span>
            </div>

            {group.effectiveStatus !== 'cancelado' && (
              <OrderStepper steps={flowLabels} currentIndex={Math.max(0, flow.indexOf(group.effectiveStatus))} className="mb-6" />
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {group.items.map((item) => (
                <PurchasedPhotoTile key={item.id} photoId={item.photo_id} photo={item.photo} status={item.status} effectiveStatus={group.effectiveStatus} />
              ))}
            </div>
          </div>
          )
        })}
      </div>
    </div>
  )
}
