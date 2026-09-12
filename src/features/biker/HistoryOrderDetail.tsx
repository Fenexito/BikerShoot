import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMyOrders, groupOrderByPhotographer, toGridPhoto, type MyOrderItem } from './useMyOrders'
import { PurchasedPhotoTile, downloadPurchasedPhoto } from './components/PurchasedPhotoTile'
import { PhotoLightbox } from './components/PhotoLightbox'
import { queryClient } from '../../lib/queryClient'
import { buildDeliveredFilename } from '../../lib/download'
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
import { supabase } from '../../lib/supabase'
import { IconDownload } from '../../ui/shared/icons'

// Con transferencia, el flujo pasa primero por "subir comprobante" — con
// tarjeta ese paso no existe (no hay comprobante manual que subir), así
// que el stepper de cada grupo usa uno u otro flujo según el método de
// pago del pedido.
const FLOW_TRANSFERENCIA: EffectiveOrderStatus[] = ['pendiente_comprobante', 'pendiente_confirmacion', 'en_preparacion', 'entregado']
const FLOW_TARJETA: EffectiveOrderStatus[] = ['pendiente_confirmacion', 'en_preparacion', 'entregado']
const JUST_CLOSED_MS = 1600

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

/** Botón de comprobante por fotógrafo — "Subir" si todavía no hay uno para
 * ese fotógrafo, o "Ver"/"Editar" (mismo visor compartido de la app) si ya
 * lo subió. Antes había un solo botón genérico "Subir comprobantes de
 * pago" que no distinguía nada de esto ni servía para revisar lo ya
 * subido. */
function ProofButton({ orderId, photographerId, photographerName, bikerName, amount, hasProof }: {
  orderId: string
  photographerId: string
  photographerName: string
  bikerName: string
  amount: number
  hasProof: boolean
}) {
  const push = useToastStore((s) => s.push)
  const [loading, setLoading] = useState(false)
  const [proof, setProof] = useState<{ viewUrl: string; uploadedAt: string } | null>(null)

  async function openViewer() {
    setLoading(true)
    try {
      const [{ data, error }, { data: row }] = await Promise.all([
        supabase.functions.invoke('r2-payment-proof-view-url', { body: { orderId, photographerId } }),
        supabase.from('order_payment_proofs').select('uploaded_at').eq('order_id', orderId).eq('photographer_id', photographerId).maybeSingle(),
      ])
      if (error || !data?.viewUrl) throw new Error(error?.message ?? 'No se pudo abrir el comprobante')
      setProof({ viewUrl: data.viewUrl, uploadedAt: row?.uploaded_at ?? '' })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo abrir el comprobante', description: (err as Error).message })
    } finally {
      setLoading(false)
    }
  }

  if (!hasProof) {
    return (
      <Link to={`/app/checkout/pago/${orderId}`}>
        <Button variant="secondary" size="sm">Subir comprobante</Button>
      </Link>
    )
  }

  return (
    <>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" loading={loading} onClick={openViewer}>Ver comprobante</Button>
        <Link to={`/app/checkout/pago/${orderId}`}>
          <Button variant="secondary" size="sm">Editar</Button>
        </Link>
      </div>
      {proof && (
        <PhotoLightbox
          photos={[
            {
              id: `proof-${photographerId}`,
              event_id: '',
              photographer_id: photographerId,
              point_id: null,
              storage_path: null,
              preview_path: null,
              raw_path: null,
              delivered_path: null,
              price: amount,
              moto_brand: null,
              featured: false,
              original_filename: null,
              created_at: '',
              eventTitle: '',
              photographerName,
            },
          ]}
          index={0}
          onClose={() => setProof(null)}
          onNavigate={() => {}}
          mode="purchased"
          resolveSrc={() => proof.viewUrl}
          infoRows={[
            { label: 'Enviado a', value: photographerName },
            { label: 'Enviado por', value: bikerName },
            ...(proof.uploadedAt ? [{ label: 'Fecha', value: new Date(proof.uploadedAt).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) }] : []),
            { label: 'Monto', value: `Q${amount}` },
          ]}
        />
      )}
    </>
  )
}

export function HistoryOrderDetail() {
  const { id } = useParams()
  useBackButton('/app/historial')
  const { user, profile } = useAuth()
  const push = useToastStore((s) => s.push)
  const { data: orders = [], isLoading } = useMyOrders(user?.id)
  const order = orders.find((o) => o.id === id)
  const photographerGroups = order ? groupOrderByPhotographer(order) : []
  const flow = order?.payment_method === 'transferencia' ? FLOW_TRANSFERENCIA : FLOW_TARJETA
  const flowLabels = flow.map((s) => getEffectiveStatusStyle(s).label)
  const proofPhotographerIds = new Set(order?.order_payment_proofs.map((p) => p.photographer_id) ?? [])

  // Un solo visor para TODO el pedido — las flechas navegan entre todas
  // las fotos compradas aquí (sin importar de qué fotógrafo/evento/punto
  // sean), no solo las de la tarjeta donde se hizo click.
  const allPhotos = useMemo(() => (order ? order.order_items.map(toGridPhoto).filter((p): p is NonNullable<typeof p> => !!p) : []), [order])
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)
  // Con tantas fotos parecidas, al cerrar el visor es fácil perder de vista
  // cuál era la que se estaba viendo — mismo resalte breve que usa Buscar.
  const [justClosedId, setJustClosedId] = useState<string | null>(null)
  const openPhoto = openIndex != null ? allPhotos[openIndex] : null
  const openItem = openPhoto ? order?.order_items.find((i) => i.photo_id === openPhoto.id) : null
  const canDownloadOpen = openItem && (openItem.status === 'en_preparacion' || openItem.status === 'entregado') && openItem.photo?.delivered_path

  function closeLightbox() {
    if (openPhoto) {
      const closedId = openPhoto.id
      setJustClosedId(closedId)
      setTimeout(() => setJustClosedId((cur) => (cur === closedId ? null : cur)), JUST_CLOSED_MS)
    }
    setOpenIndex(null)
  }

  async function handleDownloadOpen() {
    if (!openPhoto || !openItem || !order) return
    setDownloading(true)
    try {
      const filename = buildDeliveredFilename(openItem.photographer?.display_name ?? 'MotoShots', order.order_number, openItem.position, openPhoto.original_filename)
      await downloadPurchasedPhoto(openPhoto.id, filename)
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
        <Badge tone="secondary">{order.payment_method === 'tarjeta' ? 'Tarjeta' : 'Transferencia'}</Badge>
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
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-muted-foreground">{group.items.length} foto{group.items.length > 1 ? 's' : ''} · Q{group.subtotal}</span>
                  {/* Botón de comprobante propio de ESTE fotógrafo — un
                      pedido con varios fotógrafos necesita uno por cada
                      uno, no un solo botón genérico para todo el pedido. */}
                  {order.payment_method === 'transferencia' && (
                    <ProofButton
                      orderId={order.id}
                      photographerId={group.photographerId}
                      photographerName={group.photographerName}
                      bikerName={profile?.display_name ?? 'Biker'}
                      amount={group.subtotal}
                      hasProof={proofPhotographerIds.has(group.photographerId)}
                    />
                  )}
                </div>
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
                                  justClosed={item.photo_id === justClosedId}
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
          onClose={closeLightbox}
          onNavigate={setOpenIndex}
          mode="purchased"
          resolveSrc={(p) => (p.delivered_path ? queryClient.getQueryData<string | null>(['delivered-view-url', p.id]) ?? undefined : undefined)}
          cornerSlot={
            canDownloadOpen ? (
              <button
                onClick={handleDownloadOpen}
                disabled={downloading}
                className="flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <IconDownload className="h-4 w-4" /> {downloading ? 'Descargando…' : 'Descargar'}
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  )
}
