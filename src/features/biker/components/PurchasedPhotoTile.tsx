import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { previewUrl } from '../../../lib/r2'
import { downloadFile } from '../../../lib/download'
import { StatusPill } from '../../../ui/shared/StatusPill'
import { getOrderStatusStyle, getEffectiveStatusStyle, type OrderItemStatus, type EffectiveOrderStatus } from '../../../lib/orderStatus'
import { IconDownload } from '../../../ui/shared/icons'
import { useToastStore } from '../../../ui/overlays/toastStore'
import { cn } from '../../../lib/cn'

const PAID_STATUSES = new Set<OrderItemStatus>(['en_preparacion', 'entregado'])

interface PurchasedPhoto {
  storage_path: string | null
  preview_path: string | null
  delivered_path: string | null
}

/** Una vez entregada, la miniatura muestra el archivo FINAL (sin marca de
 * agua) en vez del preview — vive en el bucket privado, así que hace falta
 * una URL firmada (misma Edge Function que ya usa la descarga) en vez de
 * la URL pública que usan preview/portada. */
export function useDeliveredViewUrl(photoId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['delivered-view-url', photoId],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.functions.invoke('r2-download-url', { body: { photoId } })
      if (error || !data?.downloadUrl) return null
      return data.downloadUrl as string
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

/** Descarga (de verdad, blob + `<a download>`) la entrega final de una foto
 * comprada — reutilizada tanto por la miniatura como por el visor
 * compartido (ver `cornerSlot` en PhotoLightbox). */
export async function downloadPurchasedPhoto(photoId: string, filename: string, onDone?: () => void) {
  const { data, error } = await supabase.functions.invoke('r2-download-url', { body: { photoId } })
  if (error || !data?.downloadUrl) throw new Error(error?.message ?? 'No se pudo generar el enlace de descarga')
  await downloadFile(data.downloadUrl, filename)
  onDone?.()
}

/** Una foto comprada — miniatura + estado (opcional) + descarga (si ya se
 * puede). Misma tarjeta reusada en "Mis compras" y en el detalle de un
 * pedido. Ya NO abre su propio visor: el click se delega al `onClick` del
 * caller, que controla un único visor compartido a nivel de página (así
 * las flechas navegan entre TODAS las fotos del pedido, no solo las de
 * esta tarjeta). */
export function PurchasedPhotoTile({
  photoId,
  photo,
  status,
  effectiveStatus,
  showStatusPill = true,
  onClick,
  justClosed = false,
  downloadFilename,
}: {
  photoId: string
  photo: PurchasedPhoto | null
  status: OrderItemStatus
  /** Status enriquecido (ver `deriveEffectiveStatus`) para el pill — si no
   * se pasa, se usa el status crudo (mismo comportamiento de antes). */
  effectiveStatus?: EffectiveOrderStatus
  /** false en el detalle de pedido: el pedido/fotógrafo ya muestra un solo
   * pill con su status — repetirlo en cada foto individual es ruido, no
   * información nueva. */
  showStatusPill?: boolean
  onClick?: () => void
  /** true por un instante justo después de cerrar el visor sobre esta foto
   * — mismo resalte breve que usa Buscar, para no perderla entre las
   * demás del pedido. */
  justClosed?: boolean
  /** Nombre real para la descarga individual (ej. "Fenexito-000007-001.jpg")
   * — si no se pasa, cae a uno genérico. */
  downloadFilename?: string
}) {
  const push = useToastStore((s) => s.push)
  const [downloading, setDownloading] = useState(false)
  const delivered = !!photo?.delivered_path
  const { data: deliveredUrl } = useDeliveredViewUrl(photoId, delivered)

  const canDownload = PAID_STATUSES.has(status) && photo && (photo.delivered_path || !photo.preview_path)
  // "Todavía no está lista" cubre CUALQUIER estado antes de la entrega —
  // sin comprobante, con comprobante pendiente de confirmar, o ya en
  // preparación — no solo "en preparación sin entregar" como antes.
  const stillEditing = status !== 'cancelado' && photo?.preview_path && !photo.delivered_path
  const pillStyle = effectiveStatus ? getEffectiveStatusStyle(effectiveStatus) : getOrderStatusStyle(status)
  const thumbnailSrc = delivered && deliveredUrl ? deliveredUrl : photo ? previewUrl(photo) : undefined

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation()
    if (!photo || downloading) return
    setDownloading(true)
    try {
      await downloadPurchasedPhoto(photoId, downloadFilename ?? `motoshots-${photoId}.jpg`)
    } catch (err) {
      push({ type: 'error', title: 'No se pudo descargar', description: (err as Error).message })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className={cn('group relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted', justClosed && 'animate-photo-just-closed')}>
      {thumbnailSrc && (
        <button onClick={onClick} className="block h-full w-full" aria-label="Ver foto">
          {/* En blanco y negro mientras todavía no está lista (sin
              comprobante, pendiente de confirmar, o en preparación) — una
              señal visual clara sin necesidad de leer texto. Las
              entregadas se ven a full color, como cualquier foto normal. */}
          <img src={thumbnailSrc} alt="" className={cn('h-full w-full object-cover', stillEditing && 'grayscale')} />
        </button>
      )}
      {showStatusPill && (
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 max-w-[65%] truncate rounded-full bg-black/60 px-2 py-1">
          <StatusPill dot={pillStyle.dot} text="text-white" label={pillStyle.label} className="text-[10px]" />
        </span>
      )}
      {/* Esquina inferior derecha: check verde de "lista" + un botón chico
          de descarga individual — el visor ya tiene su propio botón de
          descarga, esto es para bajar varias sin tener que abrir cada una. */}
      {canDownload && (
        <div className="pointer-events-none absolute bottom-1.5 right-1.5 flex items-center gap-1">
          {/* Negro sólido a propósito, sin importar el tema — mismo
              criterio que el verde fijo de WhatsApp: un botón de acción
              siempre reconocible, no uno que se camufle con el fondo. */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            aria-label="Descargar esta foto"
            title="Descargar"
            className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-black text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <IconDownload className="h-3.5 w-3.5" />
          </button>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm" title="Lista para descargar">
            ✓
          </span>
        </div>
      )}
      {stillEditing && (
        <span className="pointer-events-none absolute inset-x-1.5 top-1.5 rounded-full bg-black/70 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white">
          En proceso
        </span>
      )}
    </div>
  )
}
