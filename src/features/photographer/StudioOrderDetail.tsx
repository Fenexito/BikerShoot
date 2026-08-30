import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useOrderGroup, type OrderItemStatus } from './useMyOrders'
import { queryClient } from '../../lib/queryClient'
import { supabase } from '../../lib/supabase'
import { previewUrl } from '../../lib/r2'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { Button } from '../../ui/studio/Button'
import { useToastStore } from '../../ui/overlays/toastStore'
import { PlaceholderPage } from '../auth/PlaceholderPage'
import { cn } from '../../lib/cn'

interface DeliverablePhoto {
  id: string
  storage_path: string | null
  preview_path: string | null
  delivered_path: string | null
}

function DeliverPhotoTile({ photo }: { photo: DeliverablePhoto }) {
  const push = useToastStore((s) => s.push)
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

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

      const { error: updateError } = await supabase.from('photos').update({ delivered_path: data.deliveredPath }).eq('id', photo.id)
      if (updateError) throw updateError

      push({ type: 'success', title: 'Foto entregada' })
      queryClient.invalidateQueries({ queryKey: ['photographer-order-items'] })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo entregar la foto', description: (err as Error).message })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="relative aspect-[4/5] overflow-hidden border border-border">
      <img src={previewUrl(photo)} alt="" className="h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1.5 py-1.5 text-center">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'w-full text-[10px] font-semibold uppercase tracking-wider2',
            photo.delivered_path ? 'text-accent' : 'text-white',
          )}
        >
          {uploading ? 'Subiendo…' : photo.delivered_path ? '✓ Entregada — cambiar' : 'Subir entrega final'}
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
    </div>
  )
}

const FLOW: OrderItemStatus[] = ['pendiente_pago', 'activo', 'finalizado', 'entregado']
const STATUS_LABEL: Record<OrderItemStatus, string> = {
  pendiente_pago: 'Pendiente de pago',
  activo: 'En proceso',
  finalizado: 'Finalizado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}
const NEXT_ACTION: Partial<Record<OrderItemStatus, { next: OrderItemStatus; label: string }>> = {
  pendiente_pago: { next: 'activo', label: 'Marcar como pagado' },
  activo: { next: 'finalizado', label: 'Marcar como finalizado' },
  finalizado: { next: 'entregado', label: 'Marcar como entregado' },
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

  async function advance() {
    if (!action || !user) return
    const { error } = await supabase
      .from('order_items')
      .update({ status: action.next })
      .eq('order_id', order!.orderId)
      .eq('photographer_id', user.id)

    if (error) {
      push({ type: 'error', title: 'No se pudo actualizar', description: error.message })
      return
    }
    push({ type: 'success', title: STATUS_LABEL[action.next] })
    queryClient.invalidateQueries({ queryKey: ['photographer-order-items', user.id] })
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-foreground md:px-16">
      <Link to="/studio/pedidos" className="font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground hover:text-foreground">
        ← Todos los pedidos
      </Link>

      <div className="mt-6 flex items-center gap-4">
        <InitialsAvatar name={order.bikerName} className="h-14 w-14 bg-foreground text-lg text-background" />
        <div>
          <h1 className="font-studio text-2xl font-bold tracking-tight2">{order.bikerName}</h1>
          <p className="text-muted-foreground">{order.eventTitle}</p>
        </div>
      </div>

      {order.status !== 'cancelado' && (
        <div className="mt-10 flex items-center">
          {FLOW.map((s, i) => (
            <div key={s} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 font-studio-mono text-xs',
                    i <= stepIndex ? 'border-accent bg-accent text-accent-foreground' : 'border-border text-muted-foreground',
                  )}
                >
                  {i < stepIndex ? '✓' : i + 1}
                </div>
                <span className="whitespace-nowrap text-center font-studio-mono text-[10px] uppercase tracking-wider2 text-muted-foreground">
                  {STATUS_LABEL[s]}
                </span>
              </div>
              {i < FLOW.length - 1 && <div className={cn('mx-2 h-0.5 flex-1', i < stepIndex ? 'bg-accent' : 'bg-border')} />}
            </div>
          ))}
        </div>
      )}

      <section className="mt-12">
        <h2 className="mb-4 font-studio text-lg font-bold tracking-tight2">{order.items.length} fotos compradas</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Edita cada foto por tu cuenta y sube aquí el archivo final — eso es lo que el biker va a descargar.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {order.items.map((item) => item.photo && <DeliverPhotoTile key={item.id} photo={item.photo} />)}
        </div>
      </section>

      <section className="mt-10 flex items-center justify-between border border-border p-5">
        <div>
          <p className="font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground">
            {order.paymentMethod === 'tarjeta' ? 'Pago con tarjeta' : 'Transferencia bancaria'}
          </p>
          <p className="mt-1 text-2xl font-bold">Q{order.total}</p>
        </div>
        {order.paymentMethod === 'transferencia' && (
          <Button variant="secondary" onClick={() => push({ type: 'info', title: 'Disponible en la fase de pagos' })}>
            Ver comprobante
          </Button>
        )}
      </section>

      {action && (
        <div className="mt-8 flex justify-end">
          <Button onClick={advance}>{action.label}</Button>
        </div>
      )}
    </div>
  )
}
