import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'
import { supabase } from '../../../lib/supabase'
import { previewUrl, r2Url } from '../../../lib/r2'
import { downloadFile } from '../../../lib/download'
import { StatusPill } from '../../../ui/shared/StatusPill'
import { getOrderStatusStyle, getEffectiveStatusStyle, type OrderItemStatus, type EffectiveOrderStatus } from '../../../lib/orderStatus'
import { useToastStore } from '../../../ui/overlays/toastStore'

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
function useDeliveredViewUrl(photoId: string, enabled: boolean) {
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

/** Una foto comprada — miniatura + estado + descarga (si ya se puede). Misma
 * tarjeta reusada en la lista de "Mis compras" y en el detalle de un pedido,
 * para no duplicar la lógica de descarga (URL firmada vs. archivo público). */
export function PurchasedPhotoTile({
  photoId,
  photo,
  status,
  effectiveStatus,
}: {
  photoId: string
  photo: PurchasedPhoto | null
  status: OrderItemStatus
  /** Status enriquecido (ver `deriveEffectiveStatus`) para el pill — si no
   * se pasa, se usa el status crudo (mismo comportamiento de antes). */
  effectiveStatus?: EffectiveOrderStatus
}) {
  const push = useToastStore((s) => s.push)
  const [downloading, setDownloading] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)

  const delivered = !!photo?.delivered_path
  const { data: deliveredUrl } = useDeliveredViewUrl(photoId, delivered)

  async function download() {
    if (!photo) return
    if (!photo.preview_path) {
      window.open(r2Url(photo.storage_path ?? ''), '_blank')
      return
    }
    setDownloading(true)
    try {
      const { data, error } = await supabase.functions.invoke('r2-download-url', { body: { photoId } })
      if (error || !data?.downloadUrl) throw new Error(error?.message ?? 'No se pudo generar el enlace de descarga')
      await downloadFile(data.downloadUrl, `motoshots-${photoId}.jpg`)
    } catch (err) {
      push({ type: 'error', title: 'No se pudo descargar', description: (err as Error).message })
    } finally {
      setDownloading(false)
    }
  }

  const canDownload = PAID_STATUSES.has(status) && photo && (photo.delivered_path || !photo.preview_path)
  const stillEditing = PAID_STATUSES.has(status) && photo?.preview_path && !photo.delivered_path
  const pillStyle = effectiveStatus ? getEffectiveStatusStyle(effectiveStatus) : getOrderStatusStyle(status)
  const thumbnailSrc = delivered && deliveredUrl ? deliveredUrl : photo ? previewUrl(photo) : undefined

  return (
    <div className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted">
      {thumbnailSrc && (
        <button onClick={() => setViewerOpen(true)} className="block h-full w-full" aria-label="Ver foto">
          <img src={thumbnailSrc} alt="" className="h-full w-full object-cover" />
        </button>
      )}
      <span className="pointer-events-none absolute bottom-1.5 left-1.5 right-1.5 truncate rounded-full bg-black/60 px-2 py-1">
        <StatusPill dot={pillStyle.dot} text="text-white" label={pillStyle.label} className="text-[10px]" />
      </span>
      {canDownload && (
        <button
          onClick={download}
          disabled={downloading}
          className="absolute inset-x-1.5 top-1.5 flex items-center justify-center rounded-full bg-black/70 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-black/85"
        >
          {downloading ? 'Descargando…' : '⬇ Descargar original'}
        </button>
      )}
      {stillEditing && (
        <span className="pointer-events-none absolute inset-x-1.5 top-1.5 rounded-full bg-black/70 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white">
          El fotógrafo está editando tu foto
        </span>
      )}

      {viewerOpen && thumbnailSrc && (
        <Lightbox
          open
          close={() => setViewerOpen(false)}
          index={0}
          slides={[{ src: thumbnailSrc }]}
          plugins={[Zoom]}
          zoom={{ scrollToZoom: true, maxZoomPixelRatio: 4 }}
          render={
            canDownload
              ? {
                  slideFooter: () => (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-5">
                      <button
                        onClick={download}
                        disabled={downloading}
                        className="pointer-events-auto rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {downloading ? 'Descargando…' : '⬇ Descargar'}
                      </button>
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
