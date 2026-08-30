import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMyOrders } from './useMyOrders'
import { previewUrl, r2Url } from '../../lib/r2'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/flat/Button'
import { Badge } from '../../ui/flat/Badge'
import { StatusPill } from '../../ui/shared/StatusPill'
import { getOrderStatusStyle, type OrderItemStatus } from '../../lib/orderStatus'
import { useToastStore } from '../../ui/overlays/toastStore'

const PAID_STATUSES = new Set<OrderItemStatus>(['en_preparacion', 'entregado'])

export function History() {
  const { user } = useAuth()
  const { data: orders = [], isLoading } = useMyOrders(user?.id)
  const push = useToastStore((s) => s.push)
  const [downloading, setDownloading] = useState<string | null>(null)

  async function download(photoId: string, photo: { storage_path: string | null; preview_path: string | null; delivered_path: string | null }) {
    if (!photo.preview_path) {
      // Foto de antes de proteger el original — el único archivo que existe ya es público.
      window.open(r2Url(photo.storage_path ?? ''), '_blank')
      return
    }
    setDownloading(photoId)
    try {
      const { data, error } = await supabase.functions.invoke('r2-download-url', { body: { photoId } })
      if (error || !data?.downloadUrl) throw new Error(error?.message ?? 'No se pudo generar el enlace de descarga')
      window.open(data.downloadUrl, '_blank')
    } catch (err) {
      push({ type: 'error', title: 'No se pudo descargar', description: (err as Error).message })
    } finally {
      setDownloading(null)
    }
  }

  if (isLoading) {
    return <div className="px-6 py-16 text-center text-muted-foreground font-flat">Cargando tus compras…</div>
  }

  if (orders.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-24 text-center font-flat">
        <span className="text-5xl">🧾</span>
        <h1 className="text-2xl font-bold tracking-tight">Aún no tienes compras</h1>
        <p className="text-muted-foreground">Cuando compres fotos, las verás aquí listas para descargar.</p>
        <Link to="/app/buscar">
          <Button size="lg" className="mt-4">Buscar fotos</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 font-flat md:px-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">Mis compras</h1>
      <p className="mb-8 text-muted-foreground">{orders.length} pedidos</p>

      <div className="flex flex-col gap-6">
        {orders.map((order) => (
          <div key={order.id} className="rounded-lg bg-muted p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">
                  {new Date(order.created_at).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
                <p className="font-bold">Q{order.total} · {order.order_items.length} fotos</p>
              </div>
              <Badge tone="secondary">{order.payment_method === 'tarjeta' ? 'Tarjeta' : 'Transferencia'}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {order.order_items.map((item) => (
                <div key={item.id} className="group relative aspect-[4/5] overflow-hidden rounded-md bg-background">
                  {item.photo && <img src={previewUrl(item.photo)} alt="" className="h-full w-full object-cover" />}
                  <span className="absolute bottom-1 left-1 right-1 truncate rounded bg-black/60 px-1.5 py-0.5">
                    <StatusPill
                      dot={getOrderStatusStyle(item.status).dot}
                      text="text-white"
                      label={getOrderStatusStyle(item.status).label}
                      className="text-[10px]"
                    />
                  </span>
                  {PAID_STATUSES.has(item.status) && item.photo && (item.photo.delivered_path || !item.photo.preview_path) && (
                    <button
                      onClick={() => download(item.photo_id, item.photo!)}
                      disabled={downloading === item.photo_id}
                      className="absolute inset-x-0 top-0 flex items-center justify-center bg-black/60 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-black/75"
                    >
                      {downloading === item.photo_id ? 'Generando…' : '⬇ Descargar original'}
                    </button>
                  )}
                  {PAID_STATUSES.has(item.status) && item.photo?.preview_path && !item.photo.delivered_path && (
                    <span className="absolute inset-x-0 top-0 bg-black/60 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white">
                      El fotógrafo está editando tu foto
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
