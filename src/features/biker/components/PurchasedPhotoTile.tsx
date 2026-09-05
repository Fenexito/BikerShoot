import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { previewUrl, r2Url } from '../../../lib/r2'
import { StatusPill } from '../../../ui/shared/StatusPill'
import { getOrderStatusStyle, type OrderItemStatus } from '../../../lib/orderStatus'
import { useToastStore } from '../../../ui/overlays/toastStore'

const PAID_STATUSES = new Set<OrderItemStatus>(['en_preparacion', 'entregado'])

interface PurchasedPhoto {
  storage_path: string | null
  preview_path: string | null
  delivered_path: string | null
}

/** Una foto comprada — miniatura + estado + descarga (si ya se puede). Misma
 * tarjeta reusada en la lista de "Mis compras" y en el detalle de un pedido,
 * para no duplicar la lógica de descarga (URL firmada vs. archivo público). */
export function PurchasedPhotoTile({ photoId, photo, status }: { photoId: string; photo: PurchasedPhoto | null; status: OrderItemStatus }) {
  const push = useToastStore((s) => s.push)
  const [downloading, setDownloading] = useState(false)

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
      window.open(data.downloadUrl, '_blank')
    } catch (err) {
      push({ type: 'error', title: 'No se pudo descargar', description: (err as Error).message })
    } finally {
      setDownloading(false)
    }
  }

  const canDownload = PAID_STATUSES.has(status) && photo && (photo.delivered_path || !photo.preview_path)
  const stillEditing = PAID_STATUSES.has(status) && photo?.preview_path && !photo.delivered_path

  return (
    <div className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted">
      {photo && <img src={previewUrl(photo)} alt="" className="h-full w-full object-cover" />}
      <span className="absolute bottom-1.5 left-1.5 right-1.5 truncate rounded-full bg-black/60 px-2 py-1">
        <StatusPill dot={getOrderStatusStyle(status).dot} text="text-white" label={getOrderStatusStyle(status).label} className="text-[10px]" />
      </span>
      {canDownload && (
        <button
          onClick={download}
          disabled={downloading}
          className="absolute inset-x-1.5 top-1.5 flex items-center justify-center rounded-full bg-black/70 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-black/85"
        >
          {downloading ? 'Generando…' : '⬇ Descargar original'}
        </button>
      )}
      {stillEditing && (
        <span className="absolute inset-x-1.5 top-1.5 rounded-full bg-black/70 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white">
          El fotógrafo está editando tu foto
        </span>
      )}
    </div>
  )
}
