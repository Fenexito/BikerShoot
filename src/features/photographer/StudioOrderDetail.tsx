import { useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useOrderGroup, type OrderItemStatus } from './useMyOrders'
import { queryClient } from '../../lib/queryClient'
import { supabase } from '../../lib/supabase'
import { r2Url } from '../../lib/r2'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { Button } from '../../ui/studio/Button'
import { useToastStore } from '../../ui/overlays/toastStore'
import { PlaceholderPage } from '../auth/PlaceholderPage'
import { cn } from '../../lib/cn'

const FLOW: OrderItemStatus[] = ['pendiente_pago', 'activo', 'finalizado', 'entregado']
const STATUS_LABEL: Record<OrderItemStatus, string> = {
  pendiente_pago: 'Pendiente de pago',
  activo: 'En proceso',
  finalizado: 'Finalizado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}
const NEXT_ACTION: Partial<Record<OrderItemStatus, { next: OrderItemStatus; label: string }>> = {
  pendiente_pago: { next: 'activo', label: 'Marcar como pagado' },
  activo: { next: 'finalizado', label: 'Marcar como finalizado' },
  finalizado: { next: 'entregado', label: 'Marcar como entregado' },
}

export function StudioOrderDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data: order, isLoading } = useOrderGroup(user?.id, id)
  const push = useToastStore((s) => s.push)

  if (isLoading) return <p className="px-6 py-16 text-center text-muted-foreground">Cargando pedido…</p>
  if (!order) return <PlaceholderPage title="Pedido no encontrado" />

  const stepIndex = FLOW.indexOf(order.status)
  const action = NEXT_ACTION[order.status]

  async function advance() {
    if (!action || !user) return
    const { error } = await supabase
      .from('order_items')
      .update({ status: action.next })
      .eq('order_id', order!.orderId)
      .eq('photographer_id', user.id)

    if (error) {
      push({ type: 'error', title: 'No se pudo actualizar', description: error.message })
      return
    }
    push({ type: 'success', title: STATUS_LABEL[action.next] })
    queryClient.invalidateQueries({ queryKey: ['photographer-order-items', user.id] })
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-foreground md:px-16">
      <Link to="/studio/pedidos" className="font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground hover:text-foreground">
        ← Todos los pedidos
      </Link>

      <div className="mt-6 flex items-center gap-4">
        <InitialsAvatar name={order.bikerName} className="h-14 w-14 bg-foreground text-lg text-background" />
        <div>
          <h1 className="font-studio text-2xl font-bold tracking-tight2">{order.bikerName}</h1>
          <p className="text-muted-foreground">{order.eventTitle}</p>
        </div>
      </div>

      {order.status !== 'cancelado' && (
        <div className="mt-10 flex items-center">
          {FLOW.map((s, i) => (
            <div key={s} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 font-studio-mono text-xs',
                    i <= stepIndex ? 'border-accent bg-accent text-accent-foreground' : 'border-border text-muted-foreground',
                  )}
                >
                  {i < stepIndex ? '✓' : i + 1}
                </div>
                <span className="whitespace-nowrap text-center font-studio-mono text-[10px] uppercase tracking-wider2 text-muted-foreground">
                  {STATUS_LABEL[s]}
                </span>
              </div>
              {i < FLOW.length - 1 && <div className={cn('mx-2 h-0.5 flex-1', i < stepIndex ? 'bg-accent' : 'bg-border')} />}
            </div>
          ))}
        </div>
      )}

      <section className="mt-12">
        <h2 className="mb-4 font-studio text-lg font-bold tracking-tight2">{order.items.length} fotos compradas</h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {order.items.map((item) => (
            <img
              key={item.id}
              src={item.photo ? r2Url(item.photo.storage_path) : undefined}
              alt=""
              className="aspect-[4/5] w-full border border-border object-cover"
            />
          ))}
        </div>
      </section>

      <section className="mt-10 flex items-center justify-between border border-border p-5">
        <div>
          <p className="font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground">
            {order.paymentMethod === 'tarjeta' ? 'Pago con tarjeta' : 'Transferencia bancaria'}
          </p>
          <p className="mt-1 text-2xl font-bold">Q{order.total}</p>
        </div>
        {order.paymentMethod === 'transferencia' && (
          <Button variant="secondary" onClick={() => push({ type: 'info', title: 'Disponible en la fase de pagos' })}>
            Ver comprobante
          </Button>
        )}
      </section>

      {action && (
        <div className="mt-8 flex justify-end">
          <Button onClick={advance}>{action.label}</Button>
        </div>
      )}
    </div>
  )
}
