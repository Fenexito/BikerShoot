import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMyOrders, groupOrderByPhotographer, toGridPhoto, type MyOrderItem } from './useMyOrders'
import { PurchasedPhotoTile, downloadPurchasedPhoto } from './components/PurchasedPhotoTile'
import { PhotoLightbox } from './components/PhotoLightbox'
import { queryClient } from '../../lib/queryClient'
import { Badge } from '../../ui/flat/Badge'
import { Button } from '../../ui/flat/Button'
import { StatusPill } from '../../ui/shared/StatusPill'
import { OrderStepper } from '../../ui/studio/OrderStepper'
import { formatPointSchedule } from './useCartPricing'
import { getEffectiveStatusStyle, formatOrderCode, type EffectiveOrderStatus } from '../../lib/orderStatus'
import { PlaceholderPage } from '../auth/PlaceholderPage'
import { Skeleton, SkeletonGrid } from '../../ui/shared/Skeleton'
import { useBackButton } from '../../ui/shared/useBackButton'
import { useToastStore } from '../../ui/overlays/toastStore'

// Con transferencia, el flujo pasa primero por "subir comprobante" — con
// tarjeta ese paso no existe (no hay comprobante manual que subir), así
// que el stepper de cada grupo usa uno u otro flujo según el método de
// pago del pedido.
const FLOW_TRANSFERENCIA: EffectiveOrderStatus[] = ['pendiente_comprobante', 'pendiente_confirmacion', 'en_preparacion', 'entregado']
const FLOW_TARJETA: EffectiveOrderStatus[] = ['pendiente_confirmacion', 'en_preparacion', 'entregado']

/** Agrupa las fotos de UN fotógrafo, dentro de este pedido, por evento y
 * luego por punto (con su horario) — mismo criterio visual que el carrito
 * y el checkout, para que un pedido con fotos de varios puntos no se vea
 * como una sola lista plana sin ningún criterio. */
function groupItemsByEventoPunto(items: MyOrderItem[]) {
  const byEvent = new Map<string, { eventTitle: string; items: MyOrderItem[] }>()
  for (const item of items) {
    const key = item.event?.title ?? ''
    const e = byEvent.get(key) ?? { eventTitle: key, items: [] }
    e.items.push(item)
    byEvent.set(key, e)
  }
  return Array.from(byEvent.values()).map((e) => {
    const byPoint = new Map<string, { label: string | null; timeStart: string | null; timeEnd: string | null; items: MyOrderItem[] }>()
    for (const item of e.items) {
      const label = item.photo?.point?.label ?? null
      const key = label ?? '__sin_punto__'
      const p = byPoint.get(key) ?? { label, timeStart: item.photo?.point?.time_start ?? null, timeEnd: item.photo?.point?.time_end ?? null, items: [] }
      p.items.push(item)
      byPoint.set(key, p)
    }
    return { eventTitle: e.eventTitle, points: Array.from(byPoint.values()) }
  })
}

export function HistoryOrderDetail() {
  const { id } = useParams()
  useBackButton('/app/historial')
  const { user } = useAuth()
  const push = useToastStore((s) => s.push)
  const { data: orders = [], isLoading } = useMyOrders(user?.id)
  const order = orders.find((o) => o.id === id)
  const photographerGroups = order ? groupOrderByPhotographer(order) : []
  const flow = order?.payment_method === 'transferencia' ? FLOW_TRANSFERENCIA : FLOW_TARJETA
  const flowLabels = flow.map((s) => getEffectiveStatusStyle(s).label)

  // Un solo visor para TODO el pedido — las flechas navegan entre todas
  // las fotos compradas aquí (sin importar de qué fotógrafo/evento/punto
  // sean), no solo las de la tarjeta donde se hizo click.
  const allPhotos = useMemo(() => (order ? order.order_items.map(toGridPhoto).filter((p): p is NonNullable<typeof p> => !!p) : []), [order])
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)
  const openPhoto = openIndex != null ? allPhotos[openIndex] : null
  const openItem = openPhoto ? order?.order_items.find((i) => i.photo_id === openPhoto.id) : null
  const canDownloadOpen = openItem && (openItem.status === 'en_preparacion' || openItem.status === 'entregado') && openItem.photo?.delivered_path

  async function handleDownloadOpen() {
    if (!openPhoto) return
    setDownloading(true)
    try {
      await downloadPurchasedPhoto(openPhoto.id, openPhoto.original_filename ?? `motoshots-${openPhoto.id}.jpg`)
    } catch (err) {
      push({ type: 'error', title: 'No se pudo descargar', description: (err as Error).message })
    } finally {
      setDownloading(false)
    }
  }

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

              {/* Agrupado por evento → punto (con horario) — el status ya
                  se muestra UNA vez arriba para todo el grupo, así que cada
                  miniatura se ve limpia, sin repetir el mismo pill en cada
                  una. */}
              <div className="flex flex-col gap-5">
                {groupItemsByEventoPunto(group.items).map((event) => (
                  <div key={event.eventTitle}>
                    <p className="mb-2 text-sm font-semibold">{event.eventTitle}</p>
                    <div className="flex flex-col gap-3">
                      {event.points.map((point) => {
                        const schedule = formatPointSchedule(point.timeStart, point.timeEnd)
                        return (
                          <div key={point.label ?? '__sin_punto__'}>
                            {point.label && (
                              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                                {point.label}
                                {schedule && <span className="ml-1.5 font-normal">{schedule}</span>}
                              </p>
                            )}
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                              {point.items.map((item) => (
                                <PurchasedPhotoTile
                                  key={item.id}
                                  photoId={item.photo_id}
                                  photo={item.photo}
                                  status={item.status}
                                  showStatusPill={false}
                                  onClick={() => setOpenIndex(allPhotos.findIndex((p) => p.id === item.photo_id))}
                                />
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {openPhoto && openIndex != null && (
        <PhotoLightbox
          photos={allPhotos}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
          mode="purchased"
          resolveSrc={(p) => (p.delivered_path ? queryClient.getQueryData<string | null>(['delivered-view-url', p.id]) ?? undefined : undefined)}
          cornerSlot={
            canDownloadOpen ? (
              <button
                onClick={handleDownloadOpen}
                disabled={downloading}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {downloading ? 'Descargando…' : '⬇ Descargar'}
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  )
}
