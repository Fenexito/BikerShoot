import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useOrderGroup } from './useMyOrders'
import { queryClient } from '../../lib/queryClient'
import { supabase } from '../../lib/supabase'
import { previewUrl } from '../../lib/r2'
import { getOrderStatusStyle, type OrderItemStatus } from '../../lib/orderStatus'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { StatusPill } from '../../ui/shared/StatusPill'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { Button } from '../../ui/studio/Button'
import { OrderStepper } from '../../ui/studio/OrderStepper'
import { useToastStore } from '../../ui/overlays/toastStore'
import { confirmDialog } from '../../ui/overlays/confirmStore'
import { PlaceholderPage } from '../auth/PlaceholderPage'
import { cn } from '../../lib/cn'

interface DeliverablePhoto {
  id: string
  storage_path: string | null
  preview_path: string | null
  delivered_path: string | null
  raw_path: string | null
  original_filename: string | null
  featured: boolean
}

function DeliverPhotoTile({ photo, orderItemId }: { photo: DeliverablePhoto; orderItemId: string }) {
  const push = useToastStore((s) => s.push)
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [downloadingRaw, setDownloadingRaw] = useState(false)
  const [openingDelivered, setOpeningDelivered] = useState(false)
  const [togglingFeatured, setTogglingFeatured] = useState(false)

  async function toggleFeatured() {
    setTogglingFeatured(true)
    const { error } = await supabase.from('photos').update({ featured: !photo.featured }).eq('id', photo.id)
    setTogglingFeatured(false)
    if (error) {
      push({ type: 'error', title: 'No se pudo actualizar', description: error.message })
      return
    }
    push({ type: 'success', title: photo.featured ? 'Quitada de destacadas' : '★ Agregada a tu muro de destacadas' })
    queryClient.invalidateQueries({ queryKey: ['photographer-order-items'] })
    queryClient.invalidateQueries({ queryKey: ['featured-photographer-photos'] })
  }

  async function downloadRaw() {
    setDownloadingRaw(true)
    try {
      const { data, error } = await supabase.functions.invoke('r2-raw-download-url', { body: { photoId: photo.id } })
      if (error || !data?.downloadUrl) throw new Error(error?.message ?? 'No se pudo generar el enlace')
      window.open(data.downloadUrl, '_blank')
    } catch (err) {
      push({ type: 'error', title: 'No se pudo descargar', description: (err as Error).message })
    } finally {
      setDownloadingRaw(false)
    }
  }

  async function viewDelivered() {
    setOpeningDelivered(true)
    try {
      const { data, error } = await supabase.functions.invoke('r2-delivered-view-url', { body: { photoId: photo.id } })
      if (error || !data?.downloadUrl) throw new Error(error?.message ?? 'No se pudo generar el enlace')
      window.open(data.downloadUrl, '_blank')
    } catch (err) {
      push({ type: 'error', title: 'No se pudo abrir la entrega', description: (err as Error).message })
    } finally {
      setOpeningDelivered(false)
    }
  }

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
      await supabase.from('order_items').update({ status: 'entregado' satisfies OrderItemStatus }).eq('id', orderItemId)

      push({ type: 'success', title: 'Foto entregada' })
      queryClient.invalidateQueries({ queryKey: ['photographer-order-items'] })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo entregar la foto', description: (err as Error).message })
    } finally {
      setUploading(false)
    }
  }

  const hasPreview = !!(photo.preview_path || photo.storage_path)
  const delivered = !!photo.delivered_path
  const clickable = delivered || hasPreview

  function handleTileClick() {
    if (delivered) viewDelivered()
    else if (hasPreview) window.open(previewUrl(photo), '_blank')
  }

  return (
    <div className="rounded-2xl border border-border">
      <div
        onClick={handleTileClick}
        className={cn('relative aspect-[4/5] overflow-hidden bg-muted', clickable && 'cursor-pointer')}
        title={delivered ? 'Ver entrega final' : hasPreview ? 'Ver con marca de agua' : undefined}
      >
        {hasPreview ? (
          <img src={previewUrl(photo)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-center text-[10px] text-muted-foreground">
            Vista previa liberada
            <br />
            (espacio de almacenamiento)
          </div>
        )}
        {openingDelivered && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-semibold uppercase tracking-wider2 text-white">
            Abriendo…
          </div>
        )}
        {delivered && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleFeatured() }}
            disabled={togglingFeatured}
            aria-label="Destacar en tu perfil público"
            title="Destacar en tu perfil público"
            className={cn(
              'absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center text-base transition-colors',
              photo.featured ? 'bg-accent text-white' : 'bg-black/60 text-white hover:bg-black/80',
            )}
          >
            ★
          </button>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1.5 py-1.5 text-center">
          {delivered ? (
            <span className="block text-[10px] font-semibold uppercase tracking-wider2 text-emerald-400">✓ Entregada — clic para ver</span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
              disabled={uploading}
              className="w-full text-[10px] font-semibold uppercase tracking-wider2 text-white"
            >
              {uploading ? 'Subiendo…' : 'Subir entrega final'}
            </button>
          )}
        </div>
        {!delivered && (
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onClick={(e) => e.stopPropagation()} onChange={(e) => handleFile(e.target.files?.[0])} />
        )}
      </div>
      <div className="p-2">
        <p className="truncate font-studio-mono text-[10px] text-muted-foreground" title={photo.original_filename ?? undefined}>
          {photo.original_filename ?? 'Sin nombre registrado'}
        </p>
        {photo.raw_path && (
          <button
            onClick={downloadRaw}
            disabled={downloadingRaw}
            className="mt-1 block text-[10px] font-semibold uppercase tracking-wider2 text-accent hover:underline disabled:opacity-50"
          >
            {downloadingRaw ? 'Generando…' : '⬇ Descargar original (respaldo)'}
          </button>
        )}
      </div>
    </div>
  )
}

const FLOW: OrderItemStatus[] = ['pendiente_pago', 'en_preparacion', 'entregado']
const FLOW_LABELS = FLOW.map((s) => getOrderStatusStyle(s).label)
const NEXT_ACTION: Partial<Record<OrderItemStatus, { next: OrderItemStatus; label: string }>> = {
  pendiente_pago: { next: 'en_preparacion', label: 'Confirmar pago recibido' },
}
const SECTION_COPY: Record<OrderItemStatus, string> = {
  pendiente_pago: 'Todavía no confirmas el pago de este pedido — puedes preparar las entregas, pero espera a confirmar el pago antes de avisarle al biker.',
  en_preparacion: 'Edita cada foto por tu cuenta y sube aquí el archivo final — eso es lo que el biker va a descargar. En cuanto subas las que faltan, el pedido pasa a "Entregado" automáticamente.',
  entregado: 'Pedido completo — el biker ya tiene sus archivos finales. Puedes hacer clic en cualquier foto para ver exactamente lo que se le entregó.',
  cancelado: 'Este pedido fue cancelado — el biker ya no tiene acceso a estas fotos.',
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
  const canCancel = order.status === 'pendiente_pago' || order.status === 'en_preparacion'
  const statusStyle = getOrderStatusStyle(order.status)

  async function setStatus(next: OrderItemStatus) {
    if (!user) return
    const { error } = await supabase
      .from('order_items')
      .update({ status: next })
      .eq('order_id', order!.orderId)
      .eq('photographer_id', user.id)

    if (error) {
      push({ type: 'error', title: 'No se pudo actualizar', description: error.message })
      return
    }
    push({ type: 'success', title: getOrderStatusStyle(next).label })
    queryClient.invalidateQueries({ queryKey: ['photographer-order-items', user.id] })
  }

  async function cancelOrder() {
    const ok = await confirmDialog.ask({
      title: '¿Cancelar este pedido?',
      description: 'El biker verá el pedido como cancelado. Esta acción no se puede deshacer desde aquí.',
      confirmLabel: 'Cancelar pedido',
      tone: 'danger',
    })
    if (!ok) return
    await setStatus('cancelado')
  }

  return (
    <div className={STUDIO_PAGE_WIDE}>
      <Link to="/studio/pedidos" className="font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground hover:text-foreground">
        ← Todos los pedidos
      </Link>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-6 border-b border-border pb-6">
        <div className="flex items-center gap-4">
          <InitialsAvatar name={order.bikerName} className="h-14 w-14 bg-foreground text-lg text-background" />
          <div>
            <p className="font-studio-mono text-[10px] uppercase tracking-wider2 text-muted-foreground">Comprador</p>
            <h1 className="font-studio text-2xl font-bold tracking-tight2">{order.bikerName}</h1>
            <p className="text-muted-foreground">{order.eventTitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-right">
            <p className="font-studio-mono text-[10px] uppercase tracking-wider2 text-muted-foreground">
              {order.paymentMethod === 'tarjeta' ? 'Pago con tarjeta' : 'Transferencia bancaria'}
            </p>
            <p className="font-studio text-2xl font-bold">Q{order.total}</p>
          </div>
          {order.paymentMethod === 'transferencia' && (
            <Button variant="secondary" size="sm" onClick={() => push({ type: 'info', title: 'Disponible en la fase de pagos' })}>
              Ver comprobante
            </Button>
          )}
          <StatusPill dot={statusStyle.dot} text={statusStyle.text} label={statusStyle.label} className="font-studio-mono text-xs uppercase tracking-wider2" />
        </div>
      </div>

      {order.status !== 'cancelado' && <OrderStepper steps={FLOW_LABELS} currentIndex={stepIndex} className="mt-10" />}

      <section className="mt-12">
        <h2 className="mb-4 font-studio text-lg font-bold tracking-tight2">{order.items.length} fotos compradas</h2>
        <p className="mb-4 text-sm text-muted-foreground">{SECTION_COPY[order.status]}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {order.items.map((item) => item.photo && <DeliverPhotoTile key={item.id} photo={item.photo} orderItemId={item.id} />)}
        </div>
      </section>

      <div className="mt-8 flex items-center justify-between">
        {canCancel ? (
          <Button variant="ghost" onClick={cancelOrder}>Cancelar pedido</Button>
        ) : (
          <span />
        )}
        {action && <Button onClick={() => setStatus(action.next)}>{action.label}</Button>}
      </div>
    </div>
  )
}
