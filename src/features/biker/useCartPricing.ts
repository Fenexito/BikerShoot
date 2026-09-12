import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useCartStore, type CartItem } from '../cart/cartStore'
import { computeVolumePrice, computeServiceFee, distributeAmount, type PricingTier } from './photographerPricing'

export interface CartPricedItem extends CartItem {
  /** Precio real de ESTA foto después del descuento por volumen de su
   * fotógrafo (reparto proporcional al precio de lista dentro del grupo,
   * ver `distributeAmount`) — puede ser distinto de `price` (su precio de
   * lista) en cuanto hay 2+ fotos del mismo fotógrafo en el carrito. */
  effectivePrice: number
  hasDiscount: boolean
}

export interface CartPhotographerGroup {
  photographerId: string
  photographerName: string
  items: CartPricedItem[]
  /** Suma de precios de lista, sin ningún descuento — lo que se tacha en pantalla. */
  faceSubtotal: number
  /** Total real de las fotos de este fotógrafo, ya con su descuento por volumen aplicado. */
  subtotal: number
  /** Tarifa de servicio de MotoShots para este fotógrafo (ver computeServiceFee). */
  serviceFee: number
  /** Lo que el biker debe transferirle a ESTE fotógrafo — subtotal + su tarifa. */
  totalToPay: number
}

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

/** Precio del carrito completo, en vivo — una sola fuente de verdad que
 * usan tanto el checkout de página completa como el panel lateral del
 * carrito, así los dos siempre muestran EXACTAMENTE el mismo número y se
 * actualizan igual de solos en cuanto se agrega o quita una foto. */
export function useCartPricing() {
  const items = useCartStore((s) => s.items)
  const photographerIds = useMemo(() => Array.from(new Set(items.map((i) => i.photographerId))), [items])
  const { data: tiersByPhotographer = {} } = usePhotographerPricingTiers(photographerIds)

  const photographerGroups = useMemo((): CartPhotographerGroup[] => {
    const map = new Map<string, { photographerName: string; items: CartItem[] }>()
    for (const item of items) {
      const g = map.get(item.photographerId) ?? { photographerName: item.photographerName, items: [] }
      g.items.push(item)
      map.set(item.photographerId, g)
    }
    return Array.from(map.entries()).map(([photographerId, g]) => {
      const faceSubtotal = g.items.reduce((s, i) => s + i.price, 0)
      const subtotal = computeVolumePrice(tiersByPhotographer[photographerId] ?? [], g.items.length, faceSubtotal)
      const serviceFee = computeServiceFee(g.items.length)
      const perItemPrices = distributeAmount(
        subtotal,
        g.items.map((i) => i.price),
      )
      const pricedItems: CartPricedItem[] = g.items.map((item, i) => ({
        ...item,
        effectivePrice: perItemPrices[i],
        hasDiscount: perItemPrices[i] !== item.price,
      }))
      return {
        photographerId,
        photographerName: g.photographerName,
        items: pricedItems,
        faceSubtotal,
        subtotal,
        serviceFee,
        totalToPay: subtotal + serviceFee,
      }
    })
  }, [items, tiersByPhotographer])

  const faceTotal = useMemo(() => items.reduce((s, i) => s + i.price, 0), [items])
  const discount = useMemo(() => photographerGroups.reduce((s, g) => s + (g.faceSubtotal - g.subtotal), 0), [photographerGroups])
  const serviceFeeTotal = useMemo(() => photographerGroups.reduce((s, g) => s + g.serviceFee, 0), [photographerGroups])
  const grandTotal = faceTotal - discount + serviceFeeTotal

  return { items, photographerGroups, faceTotal, discount, serviceFeeTotal, grandTotal }
}
