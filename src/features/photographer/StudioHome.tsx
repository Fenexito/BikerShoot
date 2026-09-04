import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { useMyEvents } from './useMyEvents'
import { usePhotographerOrders } from './useMyOrders'
import { supabase } from '../../lib/supabase'
import { r2Url } from '../../lib/r2'
import { EVENT_STATUS_STYLE } from '../../lib/eventStatus'
import { getOrderStatusStyle } from '../../lib/orderStatus'
import { Card } from '../../ui/studio/Card'
import { Badge } from '../../ui/studio/Badge'
import { Button } from '../../ui/studio/Button'
import { StatusPill } from '../../ui/shared/StatusPill'
import { STUDIO_PAGE_DASHBOARD } from '../../ui/studio/layout'

function usePhotoCount(photographerId: string | undefined) {
  return useQuery({
    queryKey: ['my-photo-count', photographerId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('photos')
        .select('id', { count: 'exact', head: true })
        .eq('photographer_id', photographerId)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!photographerId,
  })
}

export function StudioHome() {
  const { user, profile } = useAuth()
  const { data: events = [] } = useMyEvents(user?.id)
  const { data: orders = [] } = usePhotographerOrders(user?.id)
  const { data: photoCount = 0 } = usePhotoCount(user?.id)

  const totalSalesQ = orders.filter((o) => o.status !== 'pendiente_pago' && o.status !== 'cancelado').reduce((s, o) => s + o.total, 0)
  const pendingPayment = orders.filter((o) => o.status === 'pendiente_pago')
  const inPreparation = orders.filter((o) => o.status === 'en_preparacion')
  const needsAttention = [...pendingPayment, ...inPreparation].slice(0, 6)

  return (
    <div className={STUDIO_PAGE_DASHBOARD}>
      <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">
        Hola, {profile?.display_name || 'estudio'}
      </h1>
      <p className="mt-2 text-muted-foreground">Así va tu negocio esta semana.</p>

      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card bordered className="text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ventas (activas)</p>
          <p className="mt-2 font-studio text-3xl font-bold">Q{totalSalesQ}</p>
        </Card>
        <Card bordered className="text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pend. de pago</p>
          <p className="mt-2 font-studio text-3xl font-bold text-accent">{pendingPayment.length}</p>
        </Card>
        <Card bordered className="text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">En preparación</p>
          <p className="mt-2 font-studio text-3xl font-bold">{inPreparation.length}</p>
        </Card>
        <Card bordered className="text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fotos subidas</p>
          <p className="mt-2 font-studio text-3xl font-bold">{photoCount}</p>
        </Card>
      </div>

      <section className="mt-14">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-studio text-xl font-bold tracking-tight2">Necesita tu atención</h2>
          <Link to="/studio/pedidos" className="text-xs font-medium uppercase tracking-wide text-accent">
            Ver todos los pedidos →
          </Link>
        </div>

        {needsAttention.length === 0 ? (
          <p className="rounded-2xl border border-border px-4 py-6 text-center text-muted-foreground">Todo al día. No hay pedidos pendientes.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border rounded-2xl border border-border">
            {needsAttention.map((order) => (
              <Link
                key={order.orderId}
                to={`/studio/pedidos/${order.orderId}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{order.bikerName}</p>
                  <p className="truncate text-sm text-muted-foreground">{order.eventTitle} · {order.items.length} fotos</p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <StatusPill
                    dot={getOrderStatusStyle(order.status).dot}
                    text={getOrderStatusStyle(order.status).text}
                    label={getOrderStatusStyle(order.status).label}
                    className="text-xs font-medium uppercase tracking-wide"
                  />
                  <span className="font-bold">Q{order.total}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-14">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-studio text-xl font-bold tracking-tight2">Tus eventos</h2>
          <Link to="/studio/eventos/new">
            <Button variant="ghost">+ Crear evento</Button>
          </Link>
        </div>
        {events.length === 0 ? (
          <p className="rounded-2xl border border-border px-4 py-6 text-center text-muted-foreground">
            Todavía no tienes eventos. <Link to="/studio/eventos/new" className="text-accent">Crea el primero.</Link>
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {events.slice(0, 6).map((event) => (
              <div key={event.id} className="overflow-hidden rounded-2xl border border-border transition-colors duration-150 hover:border-border-hover">
                <div className="flex h-36 items-center justify-center overflow-hidden bg-muted">
                  {event.cover_path ? (
                    <img src={r2Url(event.cover_path)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl opacity-30">📷</span>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <Badge>{event.category}</Badge>
                    <StatusPill
                      dot={EVENT_STATUS_STYLE[event.status].dot}
                      text={EVENT_STATUS_STYLE[event.status].text}
                      label={EVENT_STATUS_STYLE[event.status].label}
                      className="text-xs font-medium uppercase tracking-wide"
                    />
                  </div>
                  <h3 className="mt-3 font-studio text-lg font-bold">{event.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Q{event.price_per_photo} por foto · {event.event_points.length} puntos · {event.photos?.[0]?.count ?? 0} fotos
                  </p>
                  <div className="mt-4">
                    <Link to={`/studio/eventos/${event.id}`}>
                      <Button variant="secondary" size="sm" className="w-full justify-center">Ver evento</Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
