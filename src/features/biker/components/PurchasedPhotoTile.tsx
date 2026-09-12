import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { previewUrl } from '../../../lib/r2'
import { downloadFile } from '../../../lib/download'
import { StatusPill } from '../../../ui/shared/StatusPill'
import { getOrderStatusStyle, getEffectiveStatusStyle, type OrderItemStatus, type EffectiveOrderStatus } from '../../../lib/orderStatus'
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
}) {
  const delivered = !!photo?.delivered_path
  const { data: deliveredUrl } = useDeliveredViewUrl(photoId, delivered)

  const canDownload = PAID_STATUSES.has(status) && photo && (photo.delivered_path || !photo.preview_path)
  const stillEditing = PAID_STATUSES.has(status) && photo?.preview_path && !photo.delivered_path
  const pillStyle = effectiveStatus ? getEffectiveStatusStyle(effectiveStatus) : getOrderStatusStyle(status)
  const thumbnailSrc = delivered && deliveredUrl ? deliveredUrl : photo ? previewUrl(photo) : undefined

  return (
    <div className={cn('group relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted', justClosed && 'animate-photo-just-closed')}>
      {thumbnailSrc && (
        <button onClick={onClick} className="block h-full w-full" aria-label="Ver foto">
          {/* En blanco y negro mientras el fotógrafo todavía la está
              editando — una señal visual clara de "todavía no está lista",
              sin necesidad de leer el texto. Las entregadas se ven a
              full color, como cualquier foto normal. */}
          <img src={thumbnailSrc} alt="" className={cn('h-full w-full object-cover', stillEditing && 'grayscale')} />
        </button>
      )}
      {showStatusPill && (
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 right-1.5 truncate rounded-full bg-black/60 px-2 py-1">
          <StatusPill dot={pillStyle.dot} text="text-white" label={pillStyle.label} className="text-[10px]" />
        </span>
      )}
      {/* Un check verde simple indica "lista" — ya no hay botón de
          descarga en la miniatura (se descarga desde el visor, que ya
          muestra el archivo final). */}
      {canDownload && (
        <span
          className="pointer-events-none absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm"
          title="Lista para descargar"
        >
          ✓
        </span>
      )}
      {stillEditing && (
        <span className="pointer-events-none absolute inset-x-1.5 top-1.5 rounded-full bg-black/70 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white">
          En proceso
        </span>
      )}
    </div>
  )
}
