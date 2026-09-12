import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCartStore } from '../cart/cartStore'
import { useAuth } from '../auth/AuthContext'
import { Input } from '../../ui/flat/Input'
import { useCartPricing, groupByEventAndPoint, formatPointSchedule } from './useCartPricing'
import { distributeServiceFee } from './photographerPricing'
import { supabase } from '../../lib/supabase'
import { previewUrl } from '../../lib/r2'
import { Button } from '../../ui/flat/Button'
import { Card } from '../../ui/flat/Card'
import { useToastStore } from '../../ui/overlays/toastStore'
import { confirmDialog } from '../../ui/overlays/confirmStore'
import { IconInfo, IconTrash } from '../../ui/shared/icons'
import { cn } from '../../lib/cn'

/** Ícono de información SOLO — el hover/foco vive en este botón puntual,
 * nunca en toda la fila que lo contiene (antes bastaba pasar el cursor
 * por "Tarifa de servicio" entero para que apareciera el tooltip). */
function InfoTooltip({ text, align = 'left' }: { text: string; align?: 'left' | 'right' }) {
  return (
    <span className="group/info relative inline-flex">
      <button
        type="button"
        tabIndex={0}
        aria-label="Más información"
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-border hover:text-foreground"
      >
        <IconInfo className="h-3 w-3" />
      </button>
      <span
        className={cn(
          'pointer-events-none absolute bottom-full mb-2 w-52 rounded-xl bg-neutral-900 p-2.5 text-[11px] font-normal normal-case leading-snug text-white opacity-0 shadow-xl transition-opacity group-hover/info:opacity-100 group-focus-within/info:opacity-100',
          align === 'left' ? 'left-0' : 'right-0',
        )}
      >
        {text}
      </span>
    </span>
  )
}

export function Checkout() {
  const items = useCartStore((s) => s.items)
  const remove = useCartStore((s) => s.remove)
  const clear = useCartStore((s) => s.clear)
  const { user, profile, updateProfileLocal } = useAuth()
  const push = useToastStore((s) => s.push)
  const navigate = useNavigate()
  const [method, setMethod] = useState<'tarjeta' | 'transferencia'>('transferencia')
  const [placing, setPlacing] = useState(false)
  // El teléfono es el único medio que tiene el fotógrafo para contactar al
  // biker (botón de WhatsApp en su portal, ver StudioOrderDetail.tsx) — se
  // precarga del perfil; si ya lo tenía, editar acá lo actualiza para
  // SIEMPRE (mismo campo `profiles.phone` que usa todo el resto de la app),
  // no solo para este pedido.
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [phoneError, setPhoneError] = useState<string | null>(null)

  const { photographerGroups, faceTotal, discount, serviceFeeTotal, grandTotal } = useCartPricing()

  async function handleRemove(photoId: string, label: string) {
    const ok = await confirmDialog.ask({
      title: '¿Quitar esta foto del carrito?',
      description: label,
      confirmLabel: 'Quitar',
      tone: 'danger',
    })
    if (ok) remove(photoId)
  }

  async function placeOrder() {
    if (!user) return
    const trimmedPhone = phone.trim()
    if (!trimmedPhone) {
      setPhoneError('Ingresa un teléfono para que el fotógrafo pueda contactarte')
      return
    }
    setPhoneError(null)
    setPlacing(true)

    if (trimmedPhone !== (profile?.phone ?? '')) {
      const { error: phoneUpdateError } = await supabase.from('profiles').update({ phone: trimmedPhone }).eq('id', user.id)
      if (phoneUpdateError) {
        push({ type: 'error', title: 'No se pudo guardar tu teléfono', description: phoneUpdateError.message })
        setPlacing(false)
        return
      }
      updateProfileLocal({ phone: trimmedPhone })
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({ biker_id: user.id, payment_method: method, total: grandTotal })
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
      // `item.price` es el precio de LISTA (sin descuento) — lo que de
      // verdad se cobra por esta foto es `effectivePrice` (ya con el
      // descuento por volumen de este fotógrafo repartido). Guardar
      // `price` aquí fue un bug real: el checkout mostraba el total
      // correcto en pantalla, pero el pedido guardado sumaba el precio de
      // lista completo — el fotógrafo y la página de comprobante de pago
      // terminaban pidiendo de más.
      return group.items.map((item, i) => ({
        order_id: order.id,
        photo_id: item.photoId,
        photographer_id: item.photographerId,
        event_id: item.eventId,
        price: item.effectivePrice,
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
    if (method === 'transferencia') {
      navigate(`/app/checkout/pago/${order.id}`)
    } else {
      navigate('/app/pedido-confirmado', { state: { total: grandTotal, count: items.length } })
    }
  }

  // `placing` sigue en true durante todo el tramo entre "vaciar el carrito"
  // y el `navigate()` de salida (éxito) — sin este chequeo, el carrito
  // vacío por un instante disparaba esta pantalla de "vacío" ANTES de que
  // React Router terminara de navegar a la página de pago/confirmación.
  if (items.length === 0 && !placing) {
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

  // El aviso de "varios fotógrafos" + el de resolución completa: en
  // escritorio van arriba de todo (se leen antes de la lista, hay espacio
  // de sobra); en móvil se leían primero y empujaban toda la lista de fotos
  // hacia abajo, así que ahí se muestran DESPUÉS de las fotos, justo antes
  // de "Resumen" — mismo bloque, solo cambia dónde se monta según el
  // tamaño de pantalla (`lg:hidden` / `hidden lg:block`).
  const notices = (
    <div className="flex flex-col gap-2">
      {photographerGroups.length > 1 && (
        <p className="text-sm text-muted-foreground">
          Incluye fotos de {photographerGroups.length} fotógrafos distintos — cada uno se paga por separado.
        </p>
      )}
      <p className="rounded-xl bg-muted px-3.5 py-2.5 text-xs text-muted-foreground">
        Todas tus fotos: resolución completa, JPEG alta calidad, descarga válida para siempre.
      </p>
    </div>
  )

  return (
    <div className="mx-auto max-w-6xl px-3 py-6 pb-28 font-flat md:px-8 md:py-10 lg:pb-10">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Tu carrito</h1>
      <div className="mt-1 hidden lg:block">{notices}</div>

      <div className="mt-6 grid min-w-0 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {photographerGroups.map((group) => (
            <div key={group.photographerId} className="flex flex-col gap-3">
              {/* Solo el conteo de fotos acá — el precio con descuento de
                  este fotógrafo ya se ve en "Resumen" (a la derecha en
                  escritorio, más abajo en móvil); repetirlo acá invitaba a
                  sumar mal (¿es antes o después del descuento por
                  volumen?). */}
              <div className="flex items-center justify-between gap-2 px-1">
                <h3 className="font-bold">{group.photographerName}</h3>
                <span className="text-sm text-muted-foreground">
                  {group.items.length} foto{group.items.length > 1 ? 's' : ''}
                </span>
              </div>
              {groupByEventAndPoint(group.items).map((event) => (
                <div key={event.eventId} className="flex flex-col gap-2.5 rounded-2xl bg-muted p-3 sm:p-4">
                  <p className="truncate text-sm font-semibold">{event.eventTitle}</p>
                  {event.points.map((point) => {
                    const schedule = formatPointSchedule(point.pointTimeStart, point.pointTimeEnd)
                    return (
                      <div key={point.key}>
                        {point.pointLabel && (
                          <p className="mb-1.5 truncate text-xs font-semibold text-foreground">
                            {point.pointLabel}
                            {schedule && <span className="ml-1.5 font-normal text-muted-foreground">{schedule}</span>}
                          </p>
                        )}
                        {/* 2 columnas en escritorio cuando comparten
                            punto+evento — con carritos grandes, mostrar cada
                            foto en su propia fila de ancho completo
                            desperdiciaba mucho espacio vertical. En móvil se
                            queda en 1 columna pero con filas más compactas
                            (miniatura chica, sin padding de sobra). */}
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {point.items.map((item) => (
                            <div key={item.photoId} className="flex items-center gap-2.5 rounded-xl bg-background p-2 sm:gap-3 sm:p-2.5">
                              <img
                                src={previewUrl({ storage_path: item.storagePath, preview_path: item.previewPath })}
                                alt=""
                                className="h-10 w-10 shrink-0 rounded-lg object-cover sm:h-12 sm:w-12"
                              />
                              <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground sm:text-sm">{item.originalFilename ?? 'Foto'}</p>
                              <div className="flex shrink-0 items-center gap-2">
                                <div className="text-right">
                                  {item.hasDiscount && <p className="text-[10px] text-muted-foreground line-through sm:text-xs">Q{item.price}</p>}
                                  <p className="text-sm font-bold">Q{item.effectivePrice}</p>
                                </div>
                                <button
                                  onClick={() => handleRemove(item.photoId, `${item.eventTitle} — Q${item.effectivePrice}`)}
                                  aria-label="Quitar del carrito"
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                                >
                                  <IconTrash className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          ))}
          <div className="lg:hidden">{notices}</div>
        </div>

        <div className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
          <Card className="cursor-default hover:scale-100">
            <h2 className="mb-4 font-bold">Resumen</h2>

            {/* Con 2+ fotógrafos, primero el precio de LISTA de cada uno
                (sin descuento todavía) — así el "Subtotal" de abajo no
                aparece de la nada: el biker ya vio de dónde sale cada
                parte antes de llegar a la suma total. Con un solo
                fotógrafo esto se omite (sería el mismo número dos veces
                seguidas, sin aportar nada). */}
            {photographerGroups.length > 1 && (
              <div className="mb-3 flex flex-col gap-1.5 border-b border-border pb-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Precio de lista por fotógrafo</p>
                {photographerGroups.map((g) => (
                  <div key={g.photographerId} className="flex justify-between text-sm">
                    <span className="truncate text-muted-foreground">{g.photographerName} ({g.items.length})</span>
                    <span className="shrink-0">Q{g.faceSubtotal}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                Subtotal ({items.length} foto{items.length > 1 ? 's' : ''})
                <InfoTooltip text="El precio de lista de tus fotos, antes de cualquier descuento por volumen." />
              </span>
              <span>Q{faceTotal}</span>
            </div>
            {discount > 0 && (
              <div className="mt-1 flex justify-between text-sm text-secondary">
                <span>Descuento por volumen</span>
                <span>-Q{discount}</span>
              </div>
            )}
            {/* La tarifa de servicio va al final, justo antes del total —
                mismo lugar donde Uber Eats/PedidosYa muestran la suya,
                después de cualquier descuento, nunca mezclada con el
                precio de las fotos. */}
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                Tarifa de servicio
                <InfoTooltip
                  text={
                    photographerGroups.length > 1
                      ? 'Mantenimiento de la plataforma, preparación/seguimiento de tu pedido y atención al cliente. Incluye la tarifa de TODOS los fotógrafos de este pedido. No es un cobro del fotógrafo — cada uno recibe el 100% de su precio.'
                      : 'Mantenimiento de la plataforma, preparación/seguimiento de tu pedido y atención al cliente. No es un cobro del fotógrafo — él recibe el 100% de su precio.'
                  }
                />
              </span>
              <span>Q{serviceFeeTotal}</span>
            </div>
            <div className="mt-3 flex justify-between border-t border-border pt-3 text-lg font-bold">
              <span>Total</span>
              <span>Q{grandTotal}</span>
            </div>
          </Card>

          <Card className="cursor-default hover:scale-100">
            <h2 className="mb-1 font-bold">Teléfono de contacto</h2>
            <p className="mb-4 text-xs text-muted-foreground">El fotógrafo lo usa para escribirte por WhatsApp sobre tu pedido.</p>
            <Input
              type="tel"
              placeholder="Ej. 5555 5555"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                if (phoneError) setPhoneError(null)
              }}
              error={phoneError ?? undefined}
            />
          </Card>

          <Card className="cursor-default hover:scale-100">
            <h2 className="mb-4 font-bold">Método de pago</h2>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setMethod('transferencia')}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors',
                  method === 'transferencia' ? 'border-primary bg-blue-50' : 'border-transparent bg-muted',
                )}
              >
                <span className={cn('flex h-4 w-4 items-center justify-center rounded-full border-2', method === 'transferencia' ? 'border-primary' : 'border-border')}>
                  {method === 'transferencia' && <span className="h-2 w-2 rounded-full bg-primary" />}
                </span>
                🏦 Transferencia bancaria
              </button>
              <div className="flex cursor-not-allowed items-center gap-3 rounded-2xl border-2 border-transparent bg-muted px-4 py-3 text-left text-sm font-medium opacity-50">
                <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-border" />
                💳 Tarjeta de crédito/débito
                <span className="ml-auto shrink-0 rounded-full bg-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Próximamente
                </span>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Después de confirmar, verás los datos bancarios de cada fotógrafo para transferir y subir tu comprobante.
            </p>
          </Card>

          <Button size="lg" loading={placing} onClick={placeOrder}>
            Confirmar pedido — Q{grandTotal}
          </Button>
        </div>
      </div>

      {/* `pl-10` (en vez de los `px-4` parejos de antes): el botón redondo de
          "Reportar bug" flota fijo en la misma esquina inferior izquierda,
          por encima de este footer (z-40 contra z-20) — sin este espacio
          extra, su píldora colapsada tapaba el conteo de fotos/precio.
          `z-20` (antes z-30, igual que MobileBottomNav) — con el mismo
          z-index, el orden de pintado hacía que este footer quedara ENCIMA
          del botón central de "Buscar" que sobresale del menú inferior; el
          menú (y su botón elevado) siempre deben ganar visualmente. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-background/95 py-3 pl-10 pr-4 backdrop-blur md:bottom-0 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{items.length} fotos</p>
            <p className="text-lg font-bold">Q{grandTotal}</p>
          </div>
          <Button loading={placing} onClick={placeOrder} className="shrink-0">
            Confirmar pedido
          </Button>
        </div>
      </div>
    </div>
  )
}
