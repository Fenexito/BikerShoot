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
          <Link to="/studio/pedidos" className="text-xs font-medium uppercase tracking-wide text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
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
              <Link
                key={event.id}
                to={`/studio/eventos/${event.id}`}
                className="group overflow-hidden rounded-3xl border border-border transition-all duration-300 hover:-translate-y-1 hover:border-border-hover hover:shadow-xl"
              >
                <div className="relative flex h-56 items-center justify-center overflow-hidden bg-muted">
                  {event.cover_path ? (
                    <img
                      src={r2Url(event.cover_path)}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-125"
                    />
                  ) : (
                    <span className="text-3xl opacity-30">📷</span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="absolute left-3 top-3">
                    <Badge className="border-white/20 bg-black/70 text-white">{event.category}</Badge>
                  </div>
                  <div className="absolute right-3 top-3">
                    <StatusPill
                      dot={EVENT_STATUS_STYLE[event.status].dot}
                      text={EVENT_STATUS_STYLE[event.status].text}
                      label={EVENT_STATUS_STYLE[event.status].label}
                      className="rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium uppercase tracking-wide"
                    />
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-studio text-lg font-bold">{event.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Q{event.price_per_photo} por foto · {event.event_points.length} puntos · {event.photos?.[0]?.count ?? 0} fotos
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
