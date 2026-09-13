import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useOrderGroup, toGridPhoto, type PhotographerOrderGroup, type RawOrderItem, type RawOrderItemPhoto } from './useMyOrders'
import { usePhotographerDetails } from './usePhotographerDetails'
import { queryClient } from '../../lib/queryClient'
import { supabase } from '../../lib/supabase'
import { previewUrl } from '../../lib/r2'
import { downloadFile, buildDeliveredFilename, uploadFileWithProgress } from '../../lib/download'
import { buildWhatsAppLink } from '../../lib/whatsapp'
import { getOrderStatusStyle, getPhotographerStatusStyle, formatOrderCode, type OrderItemStatus } from '../../lib/orderStatus'
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
import { IconDownload, IconEye } from '../../ui/shared/icons'
import { Gift } from '../../ui/animate-icons/icons/Gift'
import { Lock } from '../../ui/animate-icons/icons/Lock'
import { AnimateIcon } from '../../ui/animate-icons/icon'
import { Whatsapp } from '../../ui/animate-icons/icons/Whatsapp'
import { Trash } from '../../ui/animate-icons/icons/Trash'
import { ActionMenu, type ActionMenuItem } from '../../ui/shared/ActionMenu'
import { useHeaderTransform } from '../../ui/layout/useHeaderTransform'
import { useScrolledPast } from '../../ui/shared/useScrolledPast'
import { cn } from '../../lib/cn'

/** Cuántas cortesías puede dar el fotógrafo en este pedido, según cuántas
 * fotos REALES compró el biker (no cuenta las cortesías ya dadas) — ver
 * la sección E del documento de precios. `cortesias_ampliadas` (extra
 * nativo de Pro) suma +1 al tope combinado de cualquier franja. */
function courtesyCaps(purchasedCount: number, expanded: boolean) {
  const base = purchasedCount <= 2 ? { waivers: 0, extras: 1, combined: 1 } : purchasedCount <= 5 ? { waivers: 1, extras: 1, combined: 1 } : { waivers: 2, extras: 2, combined: 2 }
  return expanded ? { ...base, combined: base.combined + 1 } : base
}

/** Miniatura de una foto del pedido — sube la entrega final, marca/desmarca
 * como cortesía (regalo, ícono en la esquina), y abre el visor compartido
 * (el mismo de Buscar/Mis compras) al hacer click, en vez de una pestaña
 * nueva. Una vez entregada, la miniatura muestra el archivo final (sin
 * marca de agua) igual que del lado del biker. */
function DeliverPhotoTile({
  item,
  onOpen,
  canToggleGift,
  giftBusy,
  onGift,
  layout = 'grid',
  justClosed = false,
  uploadLocked,
}: {
  item: RawOrderItem
  onOpen: () => void
  /** Si el botón de regalo debe mostrarse Y ser clicable — ya calcula caps,
   * si el pedido sigue "pendiente_pago" (una foto ya pagada no se puede
   * regalar/des-regalar después de confirmar el pago), y si la foto ya fue
   * entregada (ahí se oculta del todo). */
  canToggleGift: boolean
  giftBusy: boolean
  onGift: () => void
  layout?: 'grid' | 'list'
  /** true por un instante justo después de cerrar el visor sobre esta foto
   * — mismo resalte breve que usa Buscar. */
  justClosed?: boolean
  /** true mientras el pedido sigue "pendiente_pago" — no se puede subir
   * una entrega final antes de que el biker suba su comprobante Y el
   * fotógrafo confirme el pago recibido. */
  uploadLocked: boolean
}) {
  const photo = item.photo as RawOrderItemPhoto
  const push = useToastStore((s) => s.push)
  const inputRef = useRef<HTMLInputElement>(null)
  // Progreso REAL de subida (no solo "Subiendo…") — igual que el
  // comprobante de pago, con la barra visible mientras dura.
  const [progress, setProgress] = useState<number | null>(null)
  const uploading = progress !== null
  const [downloadingOwn, setDownloadingOwn] = useState(false)

  const delivered = !!photo.delivered_path
  const { data: deliveredUrl } = useDeliveredViewUrl(photo.id, delivered)
  const hasPreview = !!(photo.preview_path || photo.storage_path)
  const thumbnailSrc = delivered && deliveredUrl ? deliveredUrl : hasPreview ? previewUrl(photo) : undefined
  const isWaiver = item.is_courtesy && item.courtesy_type === 'waiver'

  async function handleFile(file: File | undefined) {
    if (!file) return
    setProgress(0)
    try {
      const { data, error } = await supabase.functions.invoke('r2-deliver-upload-url', {
        body: { photoId: photo.id, fileName: file.name, contentType: file.type },
      })
      if (error || !data?.uploadUrl) throw new Error(error?.message ?? 'No se pudo obtener la URL de subida')

      await uploadFileWithProgress(data.uploadUrl, file, setProgress)

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
      setProgress(null)
    }
  }

  async function handleDownloadOwn(e: React.MouseEvent) {
    e.stopPropagation()
    if (downloadingOwn) return
    setDownloadingOwn(true)
    try {
      const { data, error } = await supabase.functions.invoke('r2-delivered-view-url', { body: { photoId: photo.id } })
      if (error || !data?.downloadUrl) throw new Error(error?.message ?? 'No se pudo generar el enlace')
      await downloadFile(data.downloadUrl, photo.original_filename ?? `motoshots-${photo.id}.jpg`)
    } catch (err) {
      push({ type: 'error', title: 'No se pudo descargar', description: (err as Error).message })
    } finally {
      setDownloadingOwn(false)
    }
  }

  // Se oculta del todo (ni siquiera deshabilitado) una vez entregada — a
  // esa altura ya no tiene sentido regalar o des-regalar el precio de algo
  // que el biker ya recibió.
  const giftButton = canToggleGift && (
    <AnimateIcon animateOnHover animateOnTap asChild>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onGift()
        }}
        disabled={giftBusy}
        aria-label={isWaiver ? 'Deshacer el regalo' : 'Regalar esta foto'}
        title={isWaiver ? 'Deshacer el regalo — restaura el precio original' : 'Regalar esta foto (cortesía)'}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-colors disabled:opacity-50',
          isWaiver ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-card/95 text-foreground border border-border hover:bg-card',
        )}
      >
        <Gift size={16} filled={isWaiver} />
      </button>
    </AnimateIcon>
  )

  if (layout === 'list') {
    return (
      <div className={cn('flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5', justClosed && 'animate-photo-just-closed')}>
        <button onClick={onOpen} className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted" disabled={!thumbnailSrc}>
          {thumbnailSrc && <img src={thumbnailSrc} alt="" className="h-full w-full object-cover" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={photo.original_filename ?? undefined}>
            {photo.original_filename ?? 'Sin nombre registrado'}
          </p>
          {item.is_courtesy && <p className="text-xs text-emerald-600">🎁 Regalo</p>}
          {uploading && (
            <div className="mt-1 h-1.5 w-full max-w-[10rem] overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        {!delivered && uploadLocked && (
          <span
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
            title="El biker debe subir su comprobante y tú confirmar el pago antes de poder entregar"
          >
            <Lock size={14} /> Confirma el pago primero
          </span>
        )}
        {!delivered && !uploadLocked && (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {uploading ? `Subiendo… ${progress}%` : 'Subir Archivo Final'}
            </button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          </>
        )}
        {delivered && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={handleDownloadOwn}
              disabled={downloadingOwn}
              aria-label="Descargar"
              title="Descargar"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <IconDownload className="h-3.5 w-3.5" />
            </button>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white" title="Entregada">
              ✓
            </span>
          </div>
        )}
        {giftButton}
      </div>
    )
  }

  return (
    <div className={cn('overflow-hidden rounded-3xl border border-border bg-card transition-all hover:border-accent/40 hover:shadow-sm', justClosed && 'animate-photo-just-closed')}>
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
        {/* Esquina inferior derecha (mismo lugar que del lado del biker):
            check verde de "lista" + botón chico de descarga individual —
            el visor ya tiene su propio botón, esto es para bajar varias
            sin abrir cada una. */}
        {delivered && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
            <button
              onClick={handleDownloadOwn}
              disabled={downloadingOwn}
              aria-label="Descargar"
              title="Descargar"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <IconDownload className="h-3.5 w-3.5" />
            </button>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm" title="Entregada">
              ✓
            </span>
          </div>
        )}

        {!delivered && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute inset-x-2 bottom-2">
              {uploadLocked ? (
                <span
                  className="flex w-full items-center justify-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground shadow-sm"
                  title="El biker debe subir su comprobante y tú confirmar el pago antes de poder entregar"
                >
                  <Lock size={12} /> Confirma el pago primero
                </span>
              ) : uploading ? (
                <div className="rounded-full bg-background/95 px-3 py-1.5 shadow-sm">
                  <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-foreground">
                    <span>Subiendo…</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
                  className="flex w-full items-center justify-center rounded-full bg-background/95 px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-sm transition-colors hover:bg-background"
                >
                  Subir Archivo Final
                </button>
              )}
            </div>
            {!uploadLocked && (
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onClick={(e) => e.stopPropagation()} onChange={(e) => handleFile(e.target.files?.[0])} />
            )}
          </>
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

/** Agrupa las fotos del pedido por evento y luego por punto — un mismo
 * biker puede comprarle al mismo fotógrafo fotos de eventos DISTINTOS en
 * un solo pedido, así que no se puede asumir un solo evento para todo el
 * pedido (por eso el encabezado ya no muestra un único "eventTitle"). */
function groupItemsByEventoPunto(items: RawOrderItem[]) {
  const byEvent = new Map<string, { eventTitle: string; items: RawOrderItem[] }>()
  for (const item of items) {
    const key = item.event?.title ?? ''
    const e = byEvent.get(key) ?? { eventTitle: key, items: [] }
    e.items.push(item)
    byEvent.set(key, e)
  }
  return Array.from(byEvent.values()).map((e) => {
    const byPoint = new Map<string, { label: string | null; items: RawOrderItem[] }>()
    for (const item of e.items) {
      const label = item.photo?.point?.label ?? null
      const key = label ?? '__sin_punto__'
      const p = byPoint.get(key) ?? { label, items: [] }
      p.items.push(item)
      byPoint.set(key, p)
    }
    return { eventTitle: e.eventTitle, points: Array.from(byPoint.values()) }
  })
}

/** Sección completa de fotos del pedido — grid/lista intercambiables, con
 * las mismas acciones en ambas: ver (visor compartido), subir entrega
 * final, marcar/desmarcar como regalo, y agregar una foto extra de regalo
 * (tarjeta al final, sube directo desde la galería en vez de elegir entre
 * fotos ya existentes del evento). Agrupadas por evento → punto para
 * pedidos que mezclan varios eventos del mismo fotógrafo. */
function OrderPhotosSection({
  order,
  photographerId,
  expanded,
  photographerLabel,
  pointRefs,
}: {
  order: PhotographerOrderGroup
  photographerId: string
  expanded: boolean
  photographerLabel: string
  /** Ref compartido con la página padre — ahí vive el header interactivo
   * (tanto el que transforma el header global en escritorio como la barra
   * pegajosa local en móvil, ambos calcados de StudioEventView.tsx), que
   * necesita saber qué punto está cruzando la línea de detección mientras
   * el fotógrafo hace scroll por ESTAS fotos. */
  pointRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>
}) {
  const push = useToastStore((s) => s.push)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [uploadingExtra, setUploadingExtra] = useState(false)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [justClosedId, setJustClosedId] = useState<string | null>(null)

  const purchased = order.items.filter((i) => !i.is_courtesy)
  const courtesies = order.items.filter((i) => i.is_courtesy)
  const caps = courtesyCaps(purchased.length, expanded)
  const usedCombined = courtesies.length
  // Regalar (o des-regalar) el precio de una foto YA COMPRADA solo tiene
  // sentido ANTES de confirmar el pago — después de eso el biker ya
  // transfirió el monto acordado, así que cambiar el precio retroactivo no
  // cuadra. El regalo EXTRA (una foto nueva, nunca cobrada) no tiene este
  // problema y sigue disponible en cualquier momento (salvo cancelado).
  const canWaive = order.status === 'pendiente_pago' && usedCombined < caps.combined && courtesies.filter((c) => c.courtesy_type === 'waiver').length < caps.waivers
  const canGiftExtra = order.status !== 'cancelado' && usedCombined < caps.combined && courtesies.filter((c) => c.courtesy_type === 'extra').length < caps.extras

  const allPhotos = order.items.map((item) => item.photo && toGridPhoto(item, item.event?.title ?? '', order.bikerName)).filter((p): p is NonNullable<typeof p> => !!p)
  const openPhoto = openIndex != null ? allPhotos[openIndex] : null
  const openItem = openPhoto ? order.items.find((i) => i.photo_id === openPhoto.id) : null

  function canToggleGift(item: RawOrderItem) {
    if (item.status === 'entregado') return false
    if (item.is_courtesy) return item.courtesy_type === 'waiver' && order.status === 'pendiente_pago'
    return canWaive
  }

  async function waive(item: RawOrderItem) {
    setBusyId(item.id)
    const { error } = await supabase
      .from('order_items')
      .update({ original_price: item.price, original_service_fee: item.service_fee, price: 0, service_fee: 0, is_courtesy: true, courtesy_type: 'waiver' })
      .eq('id', item.id)
    setBusyId(null)
    if (error) {
      push({ type: 'error', title: 'No se pudo regalar', description: error.message })
      return
    }
    push({ type: 'success', title: 'Foto regalada' })
    queryClient.invalidateQueries({ queryKey: ['photographer-order-items', photographerId] })
  }

  async function unwaive(item: RawOrderItem) {
    setBusyId(item.id)
    const { error } = await supabase
      .from('order_items')
      .update({ price: item.original_price ?? item.price, service_fee: item.original_service_fee ?? item.service_fee, is_courtesy: false, courtesy_type: null, original_price: null, original_service_fee: null })
      .eq('id', item.id)
    setBusyId(null)
    if (error) {
      push({ type: 'error', title: 'No se pudo deshacer el regalo', description: error.message })
      return
    }
    push({ type: 'success', title: 'Regalo deshecho — precio restaurado' })
    queryClient.invalidateQueries({ queryKey: ['photographer-order-items', photographerId] })
  }

  function toggleGift(item: RawOrderItem) {
    if (item.is_courtesy) unwaive(item)
    else waive(item)
  }

  // El regalo extra ahora se sube DIRECTO desde la galería del fotógrafo,
  // como entrega final — ya no se elige entre fotos ya subidas al evento.
  // Al biker le llega como una foto más de su pedido (con notificación).
  async function handleGiftExtraFile(file: File | undefined) {
    if (!file) return
    setUploadingExtra(true)
    try {
      const eventId = purchased[0]?.event_id ?? order.items[0]?.event_id
      const { data: photoRow, error: photoError } = await supabase
        .from('photos')
        .insert({ event_id: eventId, photographer_id: photographerId, storage_path: '', price: 0 })
        .select('id')
        .single()
      if (photoError || !photoRow) throw new Error(photoError?.message ?? 'No se pudo crear la foto')

      const { data, error } = await supabase.functions.invoke('r2-deliver-upload-url', {
        body: { photoId: photoRow.id, fileName: file.name, contentType: file.type },
      })
      if (error || !data?.uploadUrl) throw new Error(error?.message ?? 'No se pudo obtener la URL de subida')

      const putRes = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!putRes.ok) throw new Error(`R2 respondió ${putRes.status}`)

      const { error: updatePhotoError } = await supabase
        .from('photos')
        .update({ delivered_path: data.deliveredPath, delivered_size_bytes: file.size, original_filename: file.name })
        .eq('id', photoRow.id)
      if (updatePhotoError) throw updatePhotoError

      const nextPosition = order.items.reduce((max, i) => Math.max(max, i.position), -1) + 1
      const { error: itemError } = await supabase.from('order_items').insert({
        order_id: order.orderId,
        photo_id: photoRow.id,
        photographer_id: photographerId,
        event_id: eventId,
        price: 0,
        service_fee: 0,
        is_courtesy: true,
        courtesy_type: 'extra',
        status: 'entregado',
        delivered_at: new Date().toISOString(),
        position: nextPosition,
      })
      if (itemError) throw itemError

      push({ type: 'success', title: 'Foto de regalo entregada', description: 'El biker la verá como parte de su pedido.' })
      queryClient.invalidateQueries({ queryKey: ['photographer-order-items', photographerId] })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo agregar el regalo', description: (err as Error).message })
    } finally {
      setUploadingExtra(false)
    }
  }

  function closeLightbox() {
    if (openPhoto) {
      const closedId = openPhoto.id
      setJustClosedId(closedId)
      setTimeout(() => setJustClosedId((cur) => (cur === closedId ? null : cur)), 1600)
    }
    setOpenIndex(null)
  }

  async function handleDownloadOpen() {
    if (!openPhoto || !openItem) return
    setDownloading(true)
    try {
      const { data, error } = await supabase.functions.invoke('r2-delivered-view-url', { body: { photoId: openPhoto.id } })
      if (error || !data?.downloadUrl) throw new Error(error?.message ?? 'No se pudo generar el enlace')
      // El nombre del archivo usa el nombre/apodo del FOTÓGRAFO — no el del
      // biker — para que sea el MISMO archivo (mismo nombre) sin importar
      // desde qué portal se descargue esta foto.
      const filename = buildDeliveredFilename(photographerLabel, order.orderNumber, openItem.position, openPhoto.original_filename)
      await downloadFile(data.downloadUrl, filename)
    } catch (err) {
      push({ type: 'error', title: 'No se pudo descargar', description: (err as Error).message })
    } finally {
      setDownloading(false)
    }
  }

  const eventGroups = groupItemsByEventoPunto(order.items)
  const extraGiftInputId = `gift-extra-${order.orderId}`
  const extraGiftTile = canGiftExtra ? (
    <AnimateIcon animateOnHover animateOnTap asChild>
    <label
      htmlFor={extraGiftInputId}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-accent hover:text-accent',
        viewMode === 'grid' ? 'aspect-[4/5]' : 'p-4',
      )}
    >
      <Gift size={24} />
      <span className="text-xs font-semibold">{uploadingExtra ? 'Subiendo…' : '+ Regalo extra'}</span>
      <input
        id={extraGiftInputId}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploadingExtra}
        onChange={(e) => handleGiftExtraFile(e.target.files?.[0])}
      />
    </label>
    </AnimateIcon>
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

      <div className="flex flex-col gap-6">
        {eventGroups.map((eventGroup) => (
          <div key={eventGroup.eventTitle}>
            {/* El título del evento solo se repite si hay más de uno en
                este pedido — con uno solo (el caso normal) no aporta nada
                verlo una y otra vez por cada punto. */}
            {eventGroups.length > 1 && <p className="mb-2 text-sm font-semibold">{eventGroup.eventTitle}</p>}
            {eventGroup.points.map((point) => (
              // La clave del ref incluye el evento — un pedido con VARIOS
              // eventos del mismo fotógrafo puede repetir el mismo nombre de
              // punto (ej. "Curva 1") en cada uno; usar solo el label como
              // clave hacía que el registro de un punto pisara al del otro
              // evento con el mismo nombre, y la detección de scroll solo
              // podía "ver" uno de los dos.
              <div
                key={`${eventGroup.eventTitle}|||${point.label ?? ''}`}
                ref={(el) => { pointRefs.current[`${eventGroup.eventTitle}|||${point.label ?? ''}`] = el }}
                className="mb-4 last:mb-0"
              >
                {point.label && <p className="mb-2 text-xs font-semibold text-muted-foreground">{point.label}</p>}
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {point.items.map(
                      (item) =>
                        item.photo && (
                          <DeliverPhotoTile
                            key={item.id}
                            item={item}
                            onOpen={() => setOpenIndex(allPhotos.findIndex((p) => p.id === item.photo_id))}
                            canToggleGift={canToggleGift(item)}
                            giftBusy={busyId === item.id}
                            onGift={() => toggleGift(item)}
                            justClosed={item.photo_id === justClosedId}
                            uploadLocked={order.status === 'pendiente_pago'}
                          />
                        ),
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {point.items.map(
                      (item) =>
                        item.photo && (
                          <DeliverPhotoTile
                            key={item.id}
                            item={item}
                            layout="list"
                            onOpen={() => setOpenIndex(allPhotos.findIndex((p) => p.id === item.photo_id))}
                            canToggleGift={canToggleGift(item)}
                            giftBusy={busyId === item.id}
                            onGift={() => toggleGift(item)}
                            justClosed={item.photo_id === justClosedId}
                            uploadLocked={order.status === 'pendiente_pago'}
                          />
                        ),
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        {extraGiftTile && (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4' : 'flex flex-col gap-2'}>{extraGiftTile}</div>
        )}
      </div>

      {openPhoto && openIndex != null && (
        <PhotoLightbox
          photos={allPhotos}
          index={openIndex}
          onClose={closeLightbox}
          onNavigate={setOpenIndex}
          mode="purchased"
          resolveSrc={(p) => (p.delivered_path ? queryClient.getQueryData<string | null>(['delivered-view-url', p.id]) ?? undefined : undefined)}
          infoRows={[
            { label: 'Comprador', value: order.bikerName },
            { label: 'Evento', value: openItem?.event?.title ?? '' },
            ...(openPhoto.pointLabel ? [{ label: 'Punto', value: openPhoto.pointLabel }] : []),
          ]}
          cornerSlot={
            openItem?.photo?.delivered_path ? (
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
  // `viewUrl: null` mientras se resuelve — el visor se abre YA (con su
  // animación) mostrando un spinner, en vez de dejar al fotógrafo sin
  // ninguna señal por varios segundos mientras se pide la URL firmada. Si
  // resulta que el biker no ha subido nada, se cierra solo y se avisa.
  const [proof, setProof] = useState<{ viewUrl: string | null; uploadedAt: string } | null>(null)

  // Header interactivo — el mismo header global se transforma (crossfade),
  // también en móvil (`mobileEnabled`) — ver headerTransformStore.
  const scrolledPast = useScrolledPast(140)
  const [activePointLabel, setActivePointLabel] = useState<string | null>(null)
  const pointRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    function onScroll() {
      let current: string | null = null
      for (const key of Object.keys(pointRefs.current)) {
        const el = pointRefs.current[key]
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top <= 168 && rect.bottom >= 168) {
          const label = key.split('|||')[1]
          current = label ? label : null
          break
        }
      }
      setActivePointLabel(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.orderId])

  async function viewPaymentProof() {
    if (!order) return
    setProof({ viewUrl: null, uploadedAt: '' })
    try {
      const [{ data, error }, { data: row }] = await Promise.all([
        supabase.functions.invoke('r2-payment-proof-view-url', { body: { orderId: order.orderId } }),
        supabase.from('order_payment_proofs').select('uploaded_at').eq('order_id', order.orderId).eq('photographer_id', user!.id).maybeSingle(),
      ])
      if (error) throw new Error(error.message)
      if (!data?.viewUrl) {
        setProof(null)
        push({ type: 'info', title: 'El biker todavía no sube su comprobante' })
        return
      }
      setProof({ viewUrl: data.viewUrl, uploadedAt: row?.uploaded_at ?? '' })
    } catch (err) {
      setProof(null)
      push({ type: 'error', title: 'No se pudo abrir el comprobante', description: (err as Error).message })
    }
  }

  // OJO: la cancelación SOLO es válida mientras el pedido sigue
  // "pendiente_pago" (el biker aún no transfirió / el fotógrafo aún no
  // confirmó el pago) — antes también se permitía en "en_preparacion", lo
  // cual no debería ser posible unilateralmente una vez el pago ya se dio
  // por recibido.
  const canCancel = order?.status === 'pendiente_pago'
  const statusStyleForHeader = order ? getPhotographerStatusStyle(order.effectiveStatus) : null

  const actionMenuItems: ActionMenuItem[] = order
    ? [
        ...(order.paymentMethod === 'transferencia' && order.hasPaymentProof
          ? [{ label: 'Ver comprobante', icon: <IconEye className="h-4 w-4" />, onClick: viewPaymentProof }]
          : []),
        ...(order.bikerPhone
          ? [
              {
                label: 'WhatsApp',
                icon: <Whatsapp size={16} />,
                tone: 'success' as const,
                href: buildWhatsAppLink(
                  order.bikerPhone,
                  `Hola ${order.bikerName}, soy ${orderCodeName ?? 'tu fotógrafo'} de MotoShots 👋 Te escribo por tu pedido ${formatOrderCode(order.orderNumber, orderCodeName)}. Puedes ver tus fotos aquí: ${window.location.origin}/app/historial/${order.orderId}`,
                ),
              },
            ]
          : []),
        ...(canCancel ? [{ label: 'Cancelar pedido', icon: <Trash size={16} />, tone: 'danger' as const, onClick: cancelOrder }] : []),
      ]
    : []

  useHeaderTransform(
    order && statusStyleForHeader ? (
      // En móvil, estado+código van en su propia fila y el punto activo en
      // una fila debajo (con el texto tan chico, todo en una sola línea no
      // se alcanzaba a leer). En escritorio se queda como una sola línea.
      <div className="flex w-full min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center gap-2 sm:contents">
          <StatusPill dot={statusStyleForHeader.dot} text={statusStyleForHeader.text} label={statusStyleForHeader.label} className="shrink-0 text-xs font-bold uppercase tracking-wide" />
          <span className="truncate text-xs text-muted-foreground sm:hidden">{formatOrderCode(order.orderNumber)}</span>
        </div>
        <p className="hidden min-w-0 flex-1 truncate text-base font-bold sm:block">
          {formatOrderCode(order.orderNumber)}
          {activePointLabel && <span className="ml-2 text-sm font-normal text-muted-foreground">· 📍 {activePointLabel}</span>}
        </p>
        {activePointLabel && <p className="truncate text-sm font-semibold sm:hidden">📍 {activePointLabel}</p>}
      </div>
    ) : null,
    scrolledPast,
    { mobileEnabled: true, suppressAutoHide: true, hideSearchTrigger: true, actionsSlot: <ActionMenu items={actionMenuItems} /> },
  )

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

  async function setStatus(next: OrderItemStatus, extra?: Record<string, unknown>) {
    if (!user || !order) return
    const { error } = await supabase
      .from('order_items')
      .update({ status: next, ...extra })
      .eq('order_id', order.orderId)
      .eq('photographer_id', user.id)

    if (error) {
      push({ type: 'error', title: 'No se pudo actualizar', description: error.message })
      return
    }
    push({ type: 'success', title: getOrderStatusStyle(next).label })
    queryClient.invalidateQueries({ queryKey: ['photographer-order-items', user.id] })
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
  const statusStyle = getPhotographerStatusStyle(order.effectiveStatus)
  const unitPrice = order.items[0]?.price ?? 0
  const sameUnitPrice = order.items.every((i) => i.price === unitPrice)

  async function confirmAction() {
    if (action?.next === 'en_preparacion') {
      await setStatus('en_preparacion', { paid_at: new Date().toISOString() })
      return
    }
    if (action) await setStatus(action.next)
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

  // Un pedido puede tener fotos de eventos DISTINTOS del mismo fotógrafo
  // (dos compras separadas que terminaron en el mismo pedido) — mostrar un
  // solo "eventTitle" en el encabezado sería engañoso en ese caso, así que
  // se muestra solo cuando de verdad hay uno.
  const distinctEventTitles = Array.from(new Set(order.items.map((i) => i.event?.title).filter(Boolean)))
  const eventLabel = distinctEventTitles.length === 1 ? distinctEventTitles[0] : `${distinctEventTitles.length} eventos`

  // Pago + comprobante + whatsapp — en escritorio viven a la derecha junto
  // al status (misma fila, todo lo "de un vistazo" del lado derecho); en
  // móvil no caben ahí, así que bajan a su propia fila angosta debajo.
  const paymentActions = (
    <>
      <span className="rounded-full bg-muted px-3 py-1.5 text-sm font-semibold">
        {order.paymentMethod === 'tarjeta' ? 'Tarjeta' : 'Transferencia'} · Q{order.total.toFixed(2)}
      </span>
      {/* Solo si el biker YA subió algo — antes se veía siempre, aunque el
          estado fuera "Subir Comprobante" (nada que ver todavía). */}
      {order.paymentMethod === 'transferencia' && order.hasPaymentProof && (
        <Button variant="secondary" size="sm" onClick={viewPaymentProof}>
          Ver comprobante
        </Button>
      )}
      {order.bikerPhone && (
        <AnimateIcon animateOnHover animateOnTap asChild>
          <a
            href={buildWhatsAppLink(
              order.bikerPhone,
              `Hola ${order.bikerName}, soy ${orderCodeName ?? 'tu fotógrafo'} de MotoShots 👋 Te escribo por tu pedido ${formatOrderCode(order.orderNumber, orderCodeName)}. Puedes ver tus fotos aquí: ${window.location.origin}/app/historial/${order.orderId}`,
            )}
            target="_blank"
            rel="noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white transition-opacity hover:opacity-90"
            title="Escribir por WhatsApp"
            aria-label="Escribir por WhatsApp"
          >
            <Whatsapp size={16} />
          </a>
        </AnimateIcon>
      )}
    </>
  )

  return (
    <div className={STUDIO_PAGE_WIDE}>
      {/* Cabecera compacta — en escritorio, pago/comprobante/whatsapp viven
          a la derecha junto al status (una sola fila con todo lo
          importante); en móvil no caben ahí, así que bajan a su propia
          fila debajo del nombre. */}
      <div className="rounded-3xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <InitialsAvatar name={order.bikerName} className="h-12 w-12 shrink-0 bg-foreground text-base text-background sm:h-14 sm:w-14" />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">{order.bikerName}</h1>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">{formatOrderCode(order.orderNumber, orderCodeName)} · {eventLabel}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden items-center gap-2 lg:flex">{paymentActions}</div>
            {/* Más notoria que antes: texto más grande y con más padding, en
                vez de compartir el mismo tamaño chico que el resto de chips. */}
            <StatusPill dot={statusStyle.dot} text={statusStyle.text} label={statusStyle.label} className="shrink-0 text-sm font-bold" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 lg:hidden">{paymentActions}</div>

        {order.status !== 'cancelado' && <OrderStepper steps={TOP_STEP_LABELS} currentIndex={stepIndex} className="mt-6" />}

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
        {/* `profile?.display_name` (no el apodo de pedidos) — el biker solo
            conoce el nombre de perfil del fotógrafo, así que el archivo
            debe llamarse igual sin importar desde qué portal se descargue. */}
        {user && (
          <OrderPhotosSection
            order={order}
            photographerId={user.id}
            expanded={details?.feature_addon_ids.includes('cortesias_ampliadas') ?? false}
            photographerLabel={profile?.display_name ?? 'MotoShots'}
            pointRefs={pointRefs}
          />
        )}

        <aside className="rounded-3xl border border-border bg-card p-6 lg:sticky lg:top-24 lg:self-start">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">Línea de tiempo</h3>
          <OrderTimeline order={order} />
        </aside>
      </div>

      {proof && (
        <PhotoLightbox
          photos={[
            {
              id: 'proof',
              event_id: '',
              photographer_id: user?.id ?? '',
              point_id: null,
              storage_path: null,
              preview_path: null,
              raw_path: null,
              delivered_path: null,
              price: order.total,
              moto_brand: null,
              featured: false,
              original_filename: null,
              created_at: '',
              eventTitle: '',
              photographerName: orderCodeName ?? '',
            },
          ]}
          index={0}
          onClose={() => setProof(null)}
          onNavigate={() => {}}
          mode="purchased"
          loading={!proof.viewUrl}
          resolveSrc={() => proof.viewUrl ?? undefined}
          infoRows={[
            { label: 'Enviado a', value: orderCodeName ?? 'Ti' },
            { label: 'Enviado por', value: order.bikerName },
            ...(proof.uploadedAt ? [{ label: 'Fecha', value: new Date(proof.uploadedAt).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) }] : []),
            { label: 'Monto', value: `Q${order.total.toFixed(2)}` },
          ]}
          cornerSlot={
            action?.next === 'en_preparacion' ? (
              <Button
                variant="dark"
                onClick={() => {
                  confirmAction()
                  setProof(null)
                }}
              >
                Confirmar pago recibido
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  )
}
