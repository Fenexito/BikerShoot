import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMyOrders } from './useMyOrders'
import { r2Url } from '../../lib/r2'
import { Button } from '../../ui/flat/Button'
import { Badge } from '../../ui/flat/Badge'

const STATUS_LABEL: Record<string, string> = {
  pendiente_pago: 'Pendiente de pago',
  activo: 'En proceso',
  finalizado: 'Finalizado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

export function History() {
  const { user } = useAuth()
  const { data: orders = [], isLoading } = useMyOrders(user?.id)

  if (isLoading) {
    return <div className="px-6 py-16 text-center text-muted-foreground font-flat">Cargando tus compras…</div>
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
          <div key={order.id} className="rounded-lg bg-muted p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">
                  {new Date(order.created_at).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
                <p className="font-bold">Q{order.total} · {order.order_items.length} fotos</p>
              </div>
              <Badge tone="secondary">{order.payment_method === 'tarjeta' ? 'Tarjeta' : 'Transferencia'}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {order.order_items.map((item) => (
                <a
                  key={item.id}
                  href={item.photo ? r2Url(item.photo.storage_path) : undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative aspect-[4/5] overflow-hidden rounded-md bg-background"
                  title={item.event?.title ?? ''}
                >
                  {item.photo && (
                    <img src={r2Url(item.photo.storage_path)} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
                  )}
                  <span className="absolute bottom-1 left-1 right-1 truncate rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
