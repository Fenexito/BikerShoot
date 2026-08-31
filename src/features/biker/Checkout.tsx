import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCartStore } from '../cart/cartStore'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../../lib/supabase'
import { previewUrl } from '../../lib/r2'
import { Button } from '../../ui/flat/Button'
import { Card } from '../../ui/flat/Card'
import { useToastStore } from '../../ui/overlays/toastStore'
import { cn } from '../../lib/cn'

const BUNDLE_THRESHOLD = 5
const BUNDLE_DISCOUNT = 0.15

export function Checkout() {
  const items = useCartStore((s) => s.items)
  const remove = useCartStore((s) => s.remove)
  const clear = useCartStore((s) => s.clear)
  const { user } = useAuth()
  const push = useToastStore((s) => s.push)
  const navigate = useNavigate()
  const [method, setMethod] = useState<'tarjeta' | 'transferencia'>('tarjeta')
  const [placing, setPlacing] = useState(false)

  const { subtotal, discount } = useMemo(() => {
    const byEvent = new Map<string, number>()
    for (const item of items) byEvent.set(item.eventId, (byEvent.get(item.eventId) ?? 0) + item.price)

    let discountTotal = 0
    const countByEvent = new Map<string, number>()
    for (const item of items) countByEvent.set(item.eventId, (countByEvent.get(item.eventId) ?? 0) + 1)
    for (const [eventId, count] of countByEvent) {
      if (count >= BUNDLE_THRESHOLD) discountTotal += (byEvent.get(eventId) ?? 0) * BUNDLE_DISCOUNT
    }

    const subtotal = items.reduce((sum, i) => sum + i.price, 0)
    return { subtotal, discount: discountTotal }
  }, [items])

  const total = subtotal - discount

  async function placeOrder() {
    if (!user) return
    setPlacing(true)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({ biker_id: user.id, payment_method: method, total })
      .select('id')
      .single()

    if (orderError || !order) {
      push({ type: 'error', title: 'No se pudo crear el pedido', description: orderError?.message })
      setPlacing(false)
      return
    }

    const { error: itemsError } = await supabase.from('order_items').insert(
      items.map((item) => ({
        order_id: order.id,
        photo_id: item.photoId,
        photographer_id: item.photographerId,
        event_id: item.eventId,
        price: item.price,
      })),
    )

    if (itemsError) {
      push({ type: 'error', title: 'El pedido se creó, pero fallaron los detalles', description: itemsError.message })
      setPlacing(false)
      return
    }

    clear()
    navigate('/app/pedido-confirmado', { state: { total, count: items.length } })
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-24 text-center font-flat">
        <span className="text-5xl">🛒</span>
        <h1 className="text-2xl font-bold tracking-tight">Tu carrito está vacío</h1>
        <p className="text-muted-foreground">Busca tus fotos y agrégalas aquí para comprarlas.</p>
        <Link to="/app/buscar">
          <Button size="lg" className="mt-4">Buscar fotos</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 pb-24 font-flat md:px-8 lg:pb-10">
      <h1 className="mb-8 text-2xl font-bold tracking-tight md:text-3xl">Tu carrito</h1>

      <div className="grid min-w-0 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.photoId} className="flex items-center gap-3 rounded-lg bg-muted p-3 sm:gap-4">
              <img src={previewUrl({ storage_path: item.storagePath, preview_path: item.previewPath })} alt="" className="h-16 w-14 shrink-0 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{item.eventTitle}</p>
                <p className="truncate text-sm text-muted-foreground">{item.photographerName}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">Resolución completa · JPEG alta calidad · Descarga válida por siempre</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <p className="font-bold">Q{item.price}</p>
                <button
                  onClick={() => remove(item.photoId)}
                  className="text-xs text-muted-foreground hover:text-red-600"
                  aria-label="Quitar"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <h2 className="mb-4 font-bold">Resumen</h2>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{items.length} fotos</span>
              <span>Q{subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="mt-1 flex justify-between text-sm text-secondary">
                <span>Descuento por volumen</span>
                <span>-Q{discount.toFixed(2)}</span>
              </div>
            )}
            <div className="mt-3 flex justify-between border-t border-border pt-3 text-lg font-bold">
              <span>Total</span>
              <span>Q{total.toFixed(2)}</span>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 font-bold">Método de pago</h2>
            <div className="flex flex-col gap-2">
              {(['tarjeta', 'transferencia'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={cn(
                    'flex items-center gap-3 rounded-md border-2 px-4 py-3 text-left text-sm font-medium transition-colors',
                    method === m ? 'border-primary bg-blue-50' : 'border-transparent bg-muted',
                  )}
                >
                  <span className={cn('flex h-4 w-4 items-center justify-center rounded-full border-2', method === m ? 'border-primary' : 'border-border')}>
                    {method === m && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                  {m === 'tarjeta' ? '💳 Tarjeta de crédito/débito' : '🏦 Transferencia bancaria'}
                </button>
              ))}
            </div>
            {method === 'transferencia' && (
              <p className="mt-3 text-xs text-muted-foreground">
                Después de confirmar, subes tu comprobante y el fotógrafo verifica el pago. (Disponible en la próxima fase)
              </p>
            )}
          </Card>

          <Button size="lg" loading={placing} onClick={placeOrder}>
            Confirmar y pagar Q{total.toFixed(2)}
          </Button>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{items.length} fotos</p>
            <p className="text-lg font-bold">Q{total.toFixed(2)}</p>
          </div>
          <Button loading={placing} onClick={placeOrder}>
            Confirmar y pagar
          </Button>
        </div>
      </div>
    </div>
  )
}
