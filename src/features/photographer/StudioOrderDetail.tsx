import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useOrderGroup, toGridPhoto, type PhotographerOrderGroup, type RawOrderItem, type RawOrderItemPhoto } from './useMyOrders'
import { usePhotographerDetails } from './usePhotographerDetails'
import { queryClient } from '../../lib/queryClient'
import { supabase } from '../../lib/supabase'
import { previewUrl } from '../../lib/r2'
import { downloadFile } from '../../lib/download'
import { getOrderStatusStyle, getEffectiveStatusStyle, formatOrderCode, type OrderItemStatus } from '../../lib/orderStatus'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { useBackButton } from '../../ui/shared/useBackButton'
import { StatusPill } from '../../ui/shared/StatusPill'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { Button } from '../../ui/studio/Button'
import { OrderStepper } from '../../ui/studio/OrderStepper'
import { useToastStore } from '../../ui/overlays/toastStore'
import { typedConfirmDialog } from '../../ui/overlays/typedConfirmStore'
import { PlaceholderPage } from '../auth/PlaceholderPage'
import { Skeleton, SkeletonGrid } from '../../ui/shared/Skeleton'
import { PhotoLightbox } from '../biker/components/PhotoLightbox'
import { useDeliveredViewUrl } from '../biker/components/PurchasedPhotoTile'
import { IconGift } from '../../ui/shared/icons'
import { cn } from '../../lib/cn'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'

/** Cuántas cortesías puede dar el fotógrafo en este pedido, según cuántas
 * fotos REALES compró el biker (no cuenta las cortesías ya dadas) — ver
 * la sección E del documento de precios. `cortesias_ampliadas` (extra
 * nativo de Pro) suma +1 al tope combinado de cualquier franja. */
function courtesyCaps(purchasedCount: number, expanded: boolean) {
  const base = purchasedCount <= 2 ? { waivers: 0, extras: 1, combined: 1 } : purchasedCount <= 5 ? { waivers: 1, extras: 1, combined: 1 } : { waivers: 2, extras: 2, combined: 2 }
  return expanded ? { ...base, combined: base.combined + 1 } : base
}

/** Miniatura de una foto del pedido — sube la entrega final, marca como
 * cortesía (regalo, ícono en la esquina), y abre el visor compartido (el
 * mismo de Buscar/Mis compras) al hacer click, en vez de una pestaña
 * nueva. Una vez entregada, la miniatura muestra el archivo final (sin
 * marca de agua) igual que del lado del biker. */
function DeliverPhotoTile({
  item,
  onOpen,
  canGift,
  giftBusy,
  onGift,
  layout = 'grid',
}: {
  item: RawOrderItem
  onOpen: () => void
  canGift: boolean
  giftBusy: boolean
  onGift: () => void
  layout?: 'grid' | 'list'
}) {
  const photo = item.photo as RawOrderItemPhoto
  const push = useToastStore((s) => s.push)
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const delivered = !!photo.delivered_path
  const { data: deliveredUrl } = useDeliveredViewUrl(photo.id, delivered)
  const hasPreview = !!(photo.preview_path || photo.storage_path)
  const thumbnailSrc = delivered && deliveredUrl ? deliveredUrl : hasPreview ? previewUrl(photo) : undefined

  async function handleFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const { data, error } = await supabase.functions.invoke('r2-deliver-upload-url', {
        body: { photoId: photo.id, fileName: file.name, contentType: file.type },
      })
      if (error || !data?.uploadUrl) throw new Error(error?.message ?? 'No se pudo obtener la URL de subida')

      const putRes = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!putRes.ok) throw new Error(`R2 respondió ${putRes.status}`)

      const { error: updateError } = await supabase.from('photos').update({ delivered_path: data.deliveredPath, delivered_size_bytes: file.size }).eq('id', photo.id)
      if (updateError) throw updateError

      // La entrega de un archivo real es lo único que de verdad marca el
      // pedido como completado — se refleja el status automáticamente en
      // vez de depender de que el fotógrafo se acuerde de un segundo clic.
      await supabase
        .from('order_items')
        .update({ status: 'entregado' satisfies OrderItemStatus, delivered_at: new Date().toISOString() })
        .eq('id', item.id)

      push({ type: 'success', title: 'Foto entregada' })
      queryClient.invalidateQueries({ queryKey: ['photographer-order-items'] })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo entregar la foto', description: (err as Error).message })
    } finally {
      setUploading(false)
    }
  }

  const giftButton = (item.is_courtesy || canGift) && (
    <button
      onClick={(e) => {
        e.stopPropagation()
        if (!item.is_courtesy) onGift()
      }}
      disabled={giftBusy || item.is_courtesy}
      aria-label={item.is_courtesy ? 'Ya es un regalo' : 'Regalar esta foto'}
      title={item.is_courtesy ? 'Ya es un regalo para el biker' : 'Regalar esta foto (cortesía)'}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-colors',
        item.is_courtesy ? 'bg-emerald-500 text-white' : 'bg-white/95 text-foreground hover:bg-white disabled:opacity-50',
      )}
    >
      <IconGift className="h-4 w-4" filled={item.is_courtesy} />
    </button>
  )

  if (layout === 'list') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5">
        <button onClick={onOpen} className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted" disabled={!thumbnailSrc}>
          {thumbnailSrc && <img src={thumbnailSrc} alt="" className="h-full w-full object-cover" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={photo.original_filename ?? undefined}>
            {photo.original_filename ?? 'Sin nombre registrado'}
          </p>
          {item.is_courtesy && <p className="text-xs text-emerald-600">🎁 Regalo</p>}
        </div>
        {!delivered && (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {uploading ? 'Subiendo…' : 'Subir Archivo Final'}
            </button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          </>
        )}
        {delivered && <span className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600">✓ Entregada</span>}
        {giftButton}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card transition-all hover:border-accent/40 hover:shadow-sm">
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <button onClick={onOpen} className="block h-full w-full cursor-pointer" disabled={!thumbnailSrc} aria-label="Ver foto" title={delivered ? 'Ver entrega final' : 'Ver con marca de agua'}>
          {thumbnailSrc ? (
            <img src={thumbnailSrc} alt="" className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-center text-[10px] text-muted-foreground">
              Vista previa liberada
              <br />
              (espacio de almacenamiento)
            </div>
          )}
        </button>

        {giftButton && <div className="pointer-events-auto absolute right-2 top-2 z-[1]">{giftButton}</div>}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute inset-x-2 bottom-2">
          {delivered ? (
            <span className="flex items-center justify-center rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm">
              ✓ Entregada — ver
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
              disabled={uploading}
              className="flex w-full items-center justify-center rounded-full bg-background/95 px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-sm transition-colors hover:bg-background"
            >
              {uploading ? 'Subiendo…' : 'Subir Archivo Final'}
            </button>
          )}
        </div>
        {!delivered && (
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onClick={(e) => e.stopPropagation()} onChange={(e) => handleFile(e.target.files?.[0])} />
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-xs text-muted-foreground" title={photo.original_filename ?? undefined}>
          {photo.original_filename ?? 'Sin nombre registrado'}
          {item.is_courtesy && <span className="ml-1.5 text-emerald-600">🎁 Regalo</span>}
        </p>
      </div>
    </div>
  )
}

interface EventPhotoOption {
  id: string
  storage_path: string | null
  preview_path: string | null
  price: number
  original_filename: string | null
}

/** Sección completa de fotos del pedido — grid/lista intercambiables, con
 * las mismas acciones en ambas: ver (visor compartido), subir entrega
 * final, marcar como regalo, y agregar una foto extra de regalo (tarjeta
 * al final, reemplaza la vieja sección separada de "Cortesías"). */
function OrderPhotosSection({ order, photographerId, expanded }: { order: PhotographerOrderGroup; photographerId: string; expanded: boolean }) {
  const push = useToastStore((s) => s.push)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [eventPhotos, setEventPhotos] = useState<EventPhotoOption[]>([])
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)

  const purchased = order.items.filter((i) => !i.is_courtesy)
  const courtesies = order.items.filter((i) => i.is_courtesy)
  const caps = courtesyCaps(purchased.length, expanded)
  const usedCombined = courtesies.length
  const canWaive = usedCombined < caps.combined && courtesies.filter((c) => c.courtesy_type === 'waiver').length < caps.waivers
  const canGiftExtra = usedCombined < caps.combined && courtesies.filter((c) => c.courtesy_type === 'extra').length < caps.extras

  const allPhotos = order.items.map((item) => item.photo && toGridPhoto(item, order.eventTitle, order.bikerName)).filter((p): p is NonNullable<typeof p> => !!p)
  const openPhoto = openIndex != null ? allPhotos[openIndex] : null
  const openItem = openPhoto ? order.items.find((i) => i.photo_id === openPhoto.id) : null

  async function waive(item: RawOrderItem) {
    setBusyId(item.id)
    const { error } = await supabase
      .from('order_items')
      .update({ price: 0, service_fee: 0, is_courtesy: true, courtesy_type: 'waiver' })
      .eq('id', item.id)
    setBusyId(null)
    if (error) {
      push({ type: 'error', title: 'No se pudo regalar', description: error.message })
      return
    }
    push({ type: 'success', title: 'Foto regalada' })
    queryClient.invalidateQueries({ queryKey: ['photographer-order-items', photographerId] })
  }

  async function openPicker() {
    setPickerOpen(true)
    setPickerLoading(true)
    const usedIds = new Set(order.items.map((i) => i.photo_id))
    const { data, error } = await supabase
      .from('photos')
      .select('id, storage_path, preview_path, price, original_filename')
      .eq('photographer_id', photographerId)
      .eq('event_id', purchased[0]?.event_id ?? order.items[0]?.event_id)
      .eq('featured', false)
    setPickerLoading(false)
    if (error) {
      push({ type: 'error', title: 'No se pudieron cargar tus fotos', description: error.message })
      return
    }
    setEventPhotos((data ?? []).filter((p) => !usedIds.has(p.id)))
  }

  async function giftExtra(photo: EventPhotoOption) {
    setBusyId(photo.id)
    const { error } = await supabase.from('order_items').insert({
      order_id: order.orderId,
      photo_id: photo.id,
      photographer_id: photographerId,
      event_id: purchased[0]?.event_id ?? order.items[0]?.event_id,
      price: 0,
      service_fee: 0,
      is_courtesy: true,
      courtesy_type: 'extra',
      status: order.status === 'cancelado' ? 'pendiente_pago' : order.status,
    })
    setBusyId(null)
    if (error) {
      push({ type: 'error', title: 'No se pudo agregar el regalo', description: error.message })
      return
    }
    push({ type: 'success', title: 'Foto de regalo agregada al pedido' })
    setPickerOpen(false)
    queryClient.invalidateQueries({ queryKey: ['photographer-order-items', photographerId] })
  }

  async function handleDownloadOpen() {
    if (!openPhoto) return
    setDownloading(true)
    try {
      const { data, error } = await supabase.functions.invoke('r2-delivered-view-url', { body: { photoId: openPhoto.id } })
      if (error || !data?.downloadUrl) throw new Error(error?.message ?? 'No se pudo generar el enlace')
      await downloadFile(data.downloadUrl, openPhoto.original_filename ?? `motoshots-${openPhoto.id}.jpg`)
    } catch (err) {
      push({ type: 'error', title: 'No se pudo descargar', description: (err as Error).message })
    } finally {
      setDownloading(false)
    }
  }

  const extraGiftTile =
    order.status !== 'cancelado' && canGiftExtra ? (
      <button
        onClick={openPicker}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-accent hover:text-accent',
          viewMode === 'grid' ? 'aspect-[4/5]' : 'p-4',
        )}
      >
        <IconGift className="h-6 w-6" />
        <span className="text-xs font-semibold">+ Regalo extra</span>
      </button>
    ) : null

  return (
    <section>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">{order.items.length} fotos compradas</h2>
        <div className="flex gap-1 rounded-full bg-muted p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-colors', viewMode === 'grid' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-colors', viewMode === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
          >
            Lista
          </button>
        </div>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        {order.effectiveStatus === 'pendiente_comprobante' ? PENDIENTE_COMPROBANTE_COPY : SECTION_COPY[order.status]}
      </p>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {order.items.map(
            (item) =>
              item.photo && (
                <DeliverPhotoTile
                  key={item.id}
                  item={item}
                  onOpen={() => setOpenIndex(allPhotos.findIndex((p) => p.id === item.photo_id))}
                  canGift={canWaive && !item.is_courtesy}
                  giftBusy={busyId === item.id}
                  onGift={() => waive(item)}
                />
              ),
          )}
          {extraGiftTile}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {order.items.map(
            (item) =>
              item.photo && (
                <DeliverPhotoTile
                  key={item.id}
                  item={item}
                  layout="list"
                  onOpen={() => setOpenIndex(allPhotos.findIndex((p) => p.id === item.photo_id))}
                  canGift={canWaive && !item.is_courtesy}
                  giftBusy={busyId === item.id}
                  onGift={() => waive(item)}
                />
              ),
          )}
          {extraGiftTile}
        </div>
      )}

      {pickerOpen && (
        <div className="mt-5 rounded-3xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Elige la foto a regalar</h3>
            <button onClick={() => setPickerOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
          </div>
          {pickerLoading && <p className="text-sm text-muted-foreground">Cargando tus fotos de este evento…</p>}
          {!pickerLoading && eventPhotos.length === 0 && <p className="text-sm text-muted-foreground">No hay más fotos disponibles de este evento.</p>}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {eventPhotos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => giftExtra(photo)}
                disabled={busyId === photo.id}
                className="group overflow-hidden rounded-2xl border border-border disabled:opacity-50"
              >
                <img src={previewUrl(photo)} alt="" className="aspect-square w-full object-cover transition-transform group-hover:scale-105" />
              </button>
            ))}
          </div>
        </div>
      )}

      {openPhoto && openIndex != null && (
        <PhotoLightbox
          photos={allPhotos}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
          mode="purchased"
          resolveSrc={(p) => (p.delivered_path ? queryClient.getQueryData<string | null>(['delivered-view-url', p.id]) ?? undefined : undefined)}
          cornerSlot={
            openItem?.photo?.delivered_path ? (
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
    </section>
  )
}

// 4 pasos visibles (los status reales en la base de datos son solo 3) —
// "Pedido creado" siempre existe y siempre está completo para cualquier
// pedido no cancelado, así el fotógrafo ve el recorrido completo en vez
// de empezar el stepper ya a mitad de camino.
const TOP_STEP_LABELS = ['Pedido creado', 'Pago confirmado', 'En preparación', 'Entregado']
const TOP_STEP_INDEX: Record<OrderItemStatus, number> = {
  pendiente_pago: 1,
  en_preparacion: 2,
  entregado: 3,
  cancelado: 0,
}
const NEXT_ACTION: Partial<Record<OrderItemStatus, { next: OrderItemStatus; label: string }>> = {
  pendiente_pago: { next: 'en_preparacion', label: 'Confirmar pago recibido' },
}
const SECTION_COPY: Record<OrderItemStatus, string> = {
  pendiente_pago: 'Todavía no confirmas el pago de este pedido — puedes preparar las entregas, pero espera a confirmar el pago antes de avisarle al biker.',
  en_preparacion: 'Edita cada foto por tu cuenta y sube aquí el archivo final — eso es lo que el biker va a descargar. En cuanto subas las que faltan, el pedido pasa a "Entregado" automáticamente.',
  entregado: 'Pedido completo — el biker ya tiene sus archivos finales. Puedes hacer clic en cualquier foto para ver exactamente lo que se le entregó.',
  cancelado: 'Este pedido fue cancelado — el biker ya no tiene acceso a estas fotos.',
}
// El biker todavía no sube su comprobante — distinto de "ya lo subió,
// falta que yo lo revise" (mismo `status` de base, 'pendiente_pago', pero
// una situación bien distinta para el fotógrafo).
const PENDIENTE_COMPROBANTE_COPY =
  'El biker todavía no sube su comprobante de transferencia — nada que confirmar todavía. Puedes preparar las entregas mientras tanto, pero espera a confirmar el pago antes de avisarle.'

/** Guía de 3 pasos para el fotógrafo — qué toca hacer ahora mismo, no solo
 * en qué estado está el pedido. */
const CHECKLIST = [
  { status: 'pendiente_pago' as const, label: 'Confirma que recibiste el pago' },
  { status: 'en_preparacion' as const, label: 'Edita las fotos por tu cuenta' },
  { status: 'en_preparacion' as const, label: 'Súbelas aquí para entregarlas' },
]

function ActionChecklist({ status }: { status: OrderItemStatus }) {
  if (status === 'cancelado') return null
  const currentIdx = status === 'pendiente_pago' ? 0 : status === 'en_preparacion' ? 1 : 3
  return (
    <div className="mt-6 flex flex-col gap-2 rounded-2xl bg-muted/40 p-4 sm:flex-row sm:items-center sm:gap-4">
      {CHECKLIST.map((step, i) => {
        const done = i < currentIdx || status === 'entregado'
        const active = !done && i === currentIdx
        return (
          <div key={step.label} className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                done ? 'bg-foreground text-background' : active ? 'border-2 border-foreground text-foreground' : 'border border-border text-muted-foreground',
              )}
            >
              {done ? '✓' : i + 1}
            </span>
            <span className={cn('text-xs', done ? 'text-muted-foreground line-through' : active ? 'font-semibold' : 'text-muted-foreground')}>
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function timeAgoFull(iso: string) {
  return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface TimelineEvent {
  label: string
  at: string | null
  done: boolean
}

function OrderTimeline({ order }: { order: PhotographerOrderGroup }) {
  const activeItems = order.items.filter((i) => i.status !== 'cancelado')
  const deliveredCount = activeItems.filter((i) => i.delivered_at).length
  const partial = deliveredCount > 0 && deliveredCount < activeItems.length

  const events: TimelineEvent[] =
    order.status === 'cancelado'
      ? [
          { label: 'Pedido creado', at: order.createdAt, done: true },
          { label: 'Cancelado', at: order.cancelledAt, done: true },
        ]
      : [
          { label: 'Pedido creado (pendiente de pago)', at: order.createdAt, done: true },
          ...(order.paymentMethod === 'transferencia'
            ? [{ label: 'Comprobante subido', at: null, done: order.hasPaymentProof || order.status !== 'pendiente_pago' }]
            : []),
          { label: 'Pago confirmado', at: order.paidAt, done: order.status !== 'pendiente_pago' },
          { label: 'Fotos en preparación', at: order.paidAt, done: order.status === 'en_preparacion' || order.status === 'entregado' },
          ...(partial ? [{ label: `Entrega parcial (${deliveredCount}/${activeItems.length})`, at: null, done: true }] : []),
          { label: 'Entregado', at: order.deliveredAt, done: order.status === 'entregado' },
        ]

  return (
    <div className="flex flex-col gap-4">
      {events.map((ev, i) => (
        <div key={ev.label} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs', ev.done ? 'bg-foreground text-background' : 'border border-border text-muted-foreground')}>
              {ev.done ? '✓' : i + 1}
            </span>
            {i < events.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
          </div>
          <div className="pb-4">
            <p className={cn('text-sm font-semibold', !ev.done && 'text-muted-foreground')}>{ev.label}</p>
            <p className="text-xs text-muted-foreground">{ev.at ? timeAgoFull(ev.at) : ev.done ? 'Sin fecha registrada' : 'Pendiente'}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function StudioOrderDetail() {
  const { id } = useParams()
  useBackButton('/studio/pedidos')
  const { user, profile } = useAuth()
  const { data: details } = usePhotographerDetails(user?.id)
  const orderCodeName = details?.order_nickname ?? profile?.display_name
  const { data: order, isLoading } = useOrderGroup(user?.id, id)
  const push = useToastStore((s) => s.push)
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [openingProof, setOpeningProof] = useState(false)
  const [proofUrl, setProofUrl] = useState<string | null>(null)

  async function viewPaymentProof() {
    if (!order) return
    setOpeningProof(true)
    try {
      const { data, error } = await supabase.functions.invoke('r2-payment-proof-view-url', { body: { orderId: order.orderId } })
      if (error) throw new Error(error.message)
      if (!data?.viewUrl) {
        push({ type: 'info', title: 'El biker todavía no sube su comprobante' })
        return
      }
      setProofUrl(data.viewUrl)
    } catch (err) {
      push({ type: 'error', title: 'No se pudo abrir el comprobante', description: (err as Error).message })
    } finally {
      setOpeningProof(false)
    }
  }

  useEffect(() => {
    setNote(order?.note ?? '')
  }, [order?.note])

  if (isLoading) {
    return (
      <div className={STUDIO_PAGE_WIDE}>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-6 h-24 w-full rounded-3xl" />
        <SkeletonGrid count={6} className="mt-12 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" />
      </div>
    )
  }
  if (!order) return <PlaceholderPage title="Pedido no encontrado" />

  const stepIndex = TOP_STEP_INDEX[order.status]
  const action = NEXT_ACTION[order.status]
  const canCancel = order.status === 'pendiente_pago' || order.status === 'en_preparacion'
  const statusStyle = getEffectiveStatusStyle(order.effectiveStatus)
  const unitPrice = order.items[0]?.price ?? 0
  const sameUnitPrice = order.items.every((i) => i.price === unitPrice)

  async function setStatus(next: OrderItemStatus, extra?: Record<string, unknown>) {
    if (!user) return
    const { error } = await supabase
      .from('order_items')
      .update({ status: next, ...extra })
      .eq('order_id', order!.orderId)
      .eq('photographer_id', user.id)

    if (error) {
      push({ type: 'error', title: 'No se pudo actualizar', description: error.message })
      return
    }
    push({ type: 'success', title: getOrderStatusStyle(next).label })
    queryClient.invalidateQueries({ queryKey: ['photographer-order-items', user.id] })
  }

  async function confirmAction() {
    if (action?.next === 'en_preparacion') {
      await setStatus('en_preparacion', { paid_at: new Date().toISOString() })
      return
    }
    if (action) await setStatus(action.next)
  }

  async function cancelOrder() {
    if (!order) return
    const orderCode = String(order.orderNumber ?? '').padStart(6, '0')
    const { confirmed, extraValue } = await typedConfirmDialog.ask({
      title: `Esto cancela el pedido de ${order.bikerName} — el biker pierde acceso a estas fotos y recibe una notificación.`,
      description: 'Esta acción no se puede deshacer desde aquí.',
      matchText: orderCode,
      matchLabel: 'Escribe el número de pedido para confirmar',
      confirmLabel: 'Cancelar pedido',
      extraFieldLabel: 'Motivo de la cancelación',
      extraFieldPlaceholder: 'El biker verá este motivo en su notificación',
    })
    if (!confirmed) return
    await setStatus('cancelado', { cancelled_at: new Date().toISOString(), cancellation_reason: extraValue || null })
  }

  async function saveNote() {
    if (!user) return
    setSavingNote(true)
    const { error } = await supabase
      .from('order_items')
      .update({ photographer_note: note || null })
      .eq('order_id', order!.orderId)
      .eq('photographer_id', user.id)
    setSavingNote(false)
    if (error) {
      push({ type: 'error', title: 'No se pudo guardar la nota', description: error.message })
      return
    }
    push({ type: 'success', title: 'Nota guardada' })
    queryClient.invalidateQueries({ queryKey: ['photographer-order-items', user.id] })
  }

  return (
    <div className={STUDIO_PAGE_WIDE}>
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <InitialsAvatar name={order.bikerName} className="h-16 w-16 bg-foreground text-lg text-background" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Comprador</p>
              <h1 className="text-2xl font-bold tracking-tight">{order.bikerName}</h1>
              <p className="text-muted-foreground">{formatOrderCode(order.orderNumber, orderCodeName)} · {order.eventTitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-2xl bg-muted px-4 py-2.5 text-right">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {order.paymentMethod === 'tarjeta' ? 'Pago con tarjeta' : 'Transferencia bancaria'}
              </p>
              <p className="text-xl font-bold">Q{order.total.toFixed(2)}</p>
            </div>
            {order.paymentMethod === 'transferencia' && (
              <Button variant="secondary" size="sm" onClick={viewPaymentProof} loading={openingProof}>
                Ver comprobante
              </Button>
            )}
            {order.bikerPhone && (
              <a
                href={`https://wa.me/${order.bikerPhone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white transition-opacity hover:opacity-90"
                title="Escribir por WhatsApp"
                aria-label="Escribir por WhatsApp"
              >
                💬
              </a>
            )}
            <StatusPill dot={statusStyle.dot} text={statusStyle.text} label={statusStyle.label} className="text-xs" />
          </div>
        </div>

        {order.status !== 'cancelado' && <OrderStepper steps={TOP_STEP_LABELS} currentIndex={stepIndex} className="mt-8" />}

        {order.status === 'cancelado' && order.cancellationReason && (
          <div className="mt-6 rounded-2xl border border-border bg-muted/40 p-4">
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Razón de cancelación</h3>
            <p className="text-sm">{order.cancellationReason}</p>
          </div>
        )}

        <div className="mt-6 border-t border-border pt-4">
          <button
            onClick={() => setDetailsOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Detalles del pedido
            <span className={cn('text-xs transition-transform', detailsOpen && 'rotate-180')}>▾</span>
          </button>

          {detailsOpen && (
            <div className="mt-4 flex flex-col gap-6">
              {order.status !== 'cancelado' && <ActionChecklist status={order.status} />}

              <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Desglose del cobro</h3>
                {sameUnitPrice ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{order.items.length} × Q{unitPrice}</span>
                    <span className="font-semibold">Q{(order.items.length * unitPrice).toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 text-sm">
                    {order.items.map((item, i) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <span className="text-muted-foreground">Foto {i + 1}</span>
                        <span>Q{item.price}</span>
                      </div>
                    ))}
                  </div>
                )}
                {order.serviceFeeTotal > 0 && (
                  <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                    <span>Tarifa de servicio MotoShots (incluida, se liquida después)</span>
                    <span>Q{order.serviceFeeTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-base font-bold">
                  <span>Total a recibir</span>
                  <span>Q{order.total.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Nota interna</h3>
                <p className="mb-2 text-xs text-muted-foreground">Solo la ves tú — el biker nunca la ve.</p>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Ej. Cliente pidió reenviar por WhatsApp…"
                  className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm outline-none focus:border-accent"
                />
                <Button variant="secondary" size="sm" className="mt-2" onClick={saveNote} loading={savingNote}>
                  Guardar nota
                </Button>
              </div>
              </div>

              {canCancel && (
                <div className="flex justify-end border-t border-border pt-4">
                  <button onClick={cancelOrder} className="text-xs font-medium text-muted-foreground transition-colors hover:text-red-500">
                    Cancelar pedido
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {action && (
          <div className="mt-6 flex justify-end border-t border-border pt-4">
            <Button variant="dark" onClick={confirmAction}>{action.label}</Button>
          </div>
        )}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_280px]">
        {user && <OrderPhotosSection order={order} photographerId={user.id} expanded={details?.feature_addon_ids.includes('cortesias_ampliadas') ?? false} />}

        <aside className="rounded-3xl border border-border bg-card p-6 lg:sticky lg:top-24 lg:self-start">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">Línea de tiempo</h3>
          <OrderTimeline order={order} />
        </aside>
      </div>

      {proofUrl && (
        <Lightbox
          open
          close={() => setProofUrl(null)}
          index={0}
          slides={[{ src: proofUrl }]}
          plugins={[Zoom]}
          zoom={{ scrollToZoom: true, maxZoomPixelRatio: 4 }}
          render={
            action?.next === 'en_preparacion'
              ? {
                  slideFooter: () => (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-5">
                      <Button
                        variant="dark"
                        className="pointer-events-auto"
                        onClick={() => {
                          confirmAction()
                          setProofUrl(null)
                        }}
                      >
                        Confirmar pago recibido
                      </Button>
                    </div>
                  ),
                }
              : undefined
          }
        />
      )}
    </div>
  )
}
