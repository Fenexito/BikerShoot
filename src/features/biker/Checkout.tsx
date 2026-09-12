import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useCartStore, type CartItem } from '../cart/cartStore'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../../lib/supabase'
import { previewUrl } from '../../lib/r2'
import { computeVolumePrice, computeServiceFee, distributeServiceFee, type PricingTier } from './photographerPricing'
import { Button } from '../../ui/flat/Button'
import { Card } from '../../ui/flat/Card'
import { useToastStore } from '../../ui/overlays/toastStore'
import { IconInfo } from '../../ui/shared/icons'
import { cn } from '../../lib/cn'

function usePhotographerPricingTiers(photographerIds: string[]) {
  const key = photographerIds.slice().sort().join(',')
  return useQuery({
    queryKey: ['photographer-pricing-tiers', key],
    queryFn: async (): Promise<Record<string, PricingTier[]>> => {
      const { data, error } = await supabase
        .from('photographer_pricing_tiers')
        .select('photographer_id, photo_count, total_price')
        .in('photographer_id', photographerIds)
      if (error) throw error
      const map: Record<string, PricingTier[]> = {}
      for (const row of data ?? []) {
        ;(map[row.photographer_id] ??= []).push({ photo_count: row.photo_count, total_price: row.total_price })
      }
      return map
    },
    enabled: photographerIds.length > 0,
  })
}

export function Checkout() {
  const items = useCartStore((s) => s.items)
  const remove = useCartStore((s) => s.remove)
  const clear = useCartStore((s) => s.clear)
  const { user } = useAuth()
  const push = useToastStore((s) => s.push)
  const navigate = useNavigate()
  const [method, setMethod] = useState<'tarjeta' | 'transferencia'>('tarjeta')
  const [placing, setPlacing] = useState(false)

  const photographerIds = useMemo(() => Array.from(new Set(items.map((i) => i.photographerId))), [items])
  const { data: tiersByPhotographer = {} } = usePhotographerPricingTiers(photographerIds)

  const photographerGroups = useMemo(() => {
    const map = new Map<string, { photographerName: string; items: CartItem[] }>()
    for (const item of items) {
      const g = map.get(item.photographerId) ?? { photographerName: item.photographerName, items: [] }
      g.items.push(item)
      map.set(item.photographerId, g)
    }
    return Array.from(map.entries()).map(([photographerId, g]) => {
      const faceSubtotal = g.items.reduce((s, i) => s + i.price, 0)
      const volumeTotal = computeVolumePrice(tiersByPhotographer[photographerId] ?? [], g.items.length, faceSubtotal)
      // La tarifa de servicio se calcula POR FOTÓGRAFO (misma cantidad que
      // decide el descuento por volumen de arriba) — nunca sobre el pedido
      // completo, para que un carrito con varios fotógrafos no dependa de
      // cómo se reparte entre ellos (ver computeServiceFee).
      const serviceFee = computeServiceFee(g.items.length)
      return {
        photographerId,
        photographerName: g.photographerName,
        items: g.items,
        faceSubtotal,
        subtotal: volumeTotal,
        serviceFee,
      }
    })
  }, [items, tiersByPhotographer])

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price, 0), [items])
  const discount = useMemo(() => photographerGroups.reduce((s, g) => s + (g.faceSubtotal - g.subtotal), 0), [photographerGroups])
  const serviceFee = useMemo(() => photographerGroups.reduce((s, g) => s + g.serviceFee, 0), [photographerGroups])
  const total = subtotal - discount + serviceFee

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

    // Cada fotógrafo tiene una sola tarifa de servicio TOTAL (ver
    // `photographerGroups`), no un monto fijo por foto — se reparte entre
    // sus propios order_items para que cada fila tenga su valor (necesario
    // para el saldo pendiente por liquidar), ajustando el redondeo en la
    // última para que la suma cuadre exacto con el total del grupo.
    const rowsToInsert = photographerGroups.flatMap((group) => {
      const perItemFee = distributeServiceFee(group.serviceFee, group.items.length)
      return group.items.map((item, i) => ({
        order_id: order.id,
        photo_id: item.photoId,
        photographer_id: item.photographerId,
        event_id: item.eventId,
        price: item.price,
        service_fee: perItemFee[i],
      }))
    })

    const { error: itemsError } = await supabase.from('order_items').insert(rowsToInsert)

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
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-16 text-center font-flat md:py-24">
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
    <div className="mx-auto max-w-6xl px-3 py-6 pb-24 font-flat md:px-8 md:py-10 lg:pb-10">
      <h1 className="mb-8 text-2xl font-bold tracking-tight md:text-3xl">Tu carrito</h1>

      <div className="grid min-w-0 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {photographerGroups.length > 1 && (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              🧾 Este pedido incluye fotos de <strong>{photographerGroups.length} fotógrafos distintos</strong> — cada uno se
              muestra por separado con su propio subtotal.
            </div>
          )}
          {photographerGroups.map((group) => (
            <div key={group.photographerId} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 px-1">
                <h3 className="font-bold">{group.photographerName}</h3>
                <span className="text-sm text-muted-foreground">{group.items.length} foto{group.items.length > 1 ? 's' : ''} · Q{group.subtotal.toFixed(2)}</span>
              </div>
              {group.items.map((item) => (
                <div key={item.photoId} className="flex items-center gap-3 rounded-2xl bg-muted p-3 sm:gap-4">
                  <img src={previewUrl({ storage_path: item.storagePath, preview_path: item.previewPath })} alt="" className="h-16 w-14 shrink-0 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{item.eventTitle}</p>
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
          ))}
        </div>

        <div className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <h2 className="mb-4 font-bold">Resumen</h2>
            {photographerGroups.length > 1 && (
              <div className="mb-3 flex flex-col gap-1.5 border-b border-border pb-3">
                {photographerGroups.map((g) => (
                  <div key={g.photographerId} className="flex justify-between text-sm">
                    <span className="truncate text-muted-foreground">{g.photographerName} ({g.items.length})</span>
                    <span className="shrink-0">Q{g.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
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
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="group relative flex items-center gap-1 text-muted-foreground">
                Tarifa de servicio
                <span tabIndex={0} className="flex h-3.5 w-3.5 cursor-default items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
                  <IconInfo className="h-3 w-3" />
                </span>
                <span className="pointer-events-none absolute bottom-full left-0 mb-2 w-56 rounded-xl bg-neutral-900 p-3 text-xs font-normal normal-case text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  Cubre el mantenimiento de la plataforma, la preparación y seguimiento de tu pedido, y la atención al cliente de
                  MotoShots. No es un cobro del fotógrafo — él recibe el 100% de su precio.
                </span>
              </span>
              <span>Q{serviceFee.toFixed(2)}</span>
            </div>
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
                    'flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors',
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

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:bottom-0 lg:hidden">
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
