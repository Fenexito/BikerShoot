import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMyOrders, type MyOrder } from './useMyOrders'
import { PurchasedPhotoTile } from './components/PurchasedPhotoTile'
import { Button } from '../../ui/flat/Button'
import { Badge } from '../../ui/flat/Badge'
import { formatOrderCode } from '../../lib/orderStatus'
import { SkeletonRows } from '../../ui/shared/Skeleton'
import { cn } from '../../lib/cn'

function monthKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(iso: string) {
  const label = new Date(iso).toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Un mes de pedidos — colapsable, igual que las categorías de estado en
 * Pedidos del portal del fotógrafo (ahí se agrupa por estado; aquí, por
 * fecha, ya que un biker no tiene "estados" que le sirvan tanto como
 * saber si un pedido es reciente o de hace meses). El mes más reciente
 * empieza abierto, el resto cerrado — así se puede "ocultar lo antiguo"
 * de un vistazo sin perder acceso a nada. */
function MonthSection({ label, orders, defaultOpen }: { label: string; orders: MyOrder[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="mb-3 flex w-full items-center justify-between gap-2 text-left">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {label}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{orders.length}</span>
        </h2>
        <span className={cn('text-xs text-muted-foreground transition-transform', open && 'rotate-180')}>▾</span>
      </button>
      {open && (
        <div className="flex flex-col gap-4">
          {orders.map((order, i) => (
            <Link
              key={order.id}
              to={`/app/historial/${order.id}`}
              className="animate-[fade-in-up_.3s_ease-out_backwards] block rounded-3xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
              style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
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
      )}
    </div>
  )
}

export function History() {
  const { user } = useAuth()
  const { data: orders = [], isLoading } = useMyOrders(user?.id)

  const months = useMemo(() => {
    const map = new Map<string, MyOrder[]>()
    for (const o of orders) {
      const key = monthKey(o.created_at)
      const list = map.get(key) ?? []
      list.push(o)
      map.set(key, list)
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, list]) => ({ key, label: monthLabel(list[0].created_at), orders: list }))
  }, [orders])

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

      <div className="flex flex-col gap-8">
        {months.map((month, i) => (
          <MonthSection key={month.key} label={month.label} orders={month.orders} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  )
}
