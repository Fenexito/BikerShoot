import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getOrderById, ORDER_STATUS_LABEL, type OrderStatus } from '../../data/mockStudio'
import { thumbUrl } from '../../data/mockPhotos'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { Button } from '../../ui/studio/Button'
import { useToastStore } from '../../ui/overlays/toastStore'
import { PlaceholderPage } from '../auth/PlaceholderPage'
import { cn } from '../../lib/cn'

const FLOW: OrderStatus[] = ['pendiente_pago', 'activo', 'finalizado', 'entregado']
const NEXT_ACTION: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  pendiente_pago: { next: 'activo', label: 'Marcar como pagado' },
  activo: { next: 'finalizado', label: 'Marcar como finalizado' },
  finalizado: { next: 'entregado', label: 'Marcar como entregado' },
}

export function StudioOrderDetail() {
  const { id } = useParams()
  const order = getOrderById(id ?? '')
  const push = useToastStore((s) => s.push)
  const [status, setStatus] = useState<OrderStatus | undefined>(order?.status)

  if (!order || !status) return <PlaceholderPage title="Pedido no encontrado" />

  const stepIndex = FLOW.indexOf(status)
  const action = NEXT_ACTION[status]

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

      {/* Stepper */}
      {status !== 'cancelado' && (
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
                  {ORDER_STATUS_LABEL[s]}
                </span>
              </div>
              {i < FLOW.length - 1 && <div className={cn('mx-2 h-0.5 flex-1', i < stepIndex ? 'bg-accent' : 'bg-border')} />}
            </div>
          ))}
        </div>
      )}

      {/* Items */}
      <section className="mt-12">
        <h2 className="mb-4 font-studio text-lg font-bold tracking-tight2">{order.items.length} fotos compradas</h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {order.items.map((item, i) => (
            <img key={i} src={thumbUrl(item.photoSeed, 200, 250)} alt="" className="aspect-[4/5] w-full border border-border object-cover" />
          ))}
        </div>
      </section>

      {/* Pago */}
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
          <Button
            onClick={() => {
              setStatus(action.next)
              push({ type: 'success', title: ORDER_STATUS_LABEL[action.next] })
            }}
          >
            {action.label}
          </Button>
        </div>
      )}
    </div>
  )
}
