import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useCartStore } from './cartStore'
import { useCartDrawerStore } from './cartDrawerStore'
import { useCartPricing, groupByEventAndPoint, formatPointSchedule, type CartPricedItem } from '../biker/useCartPricing'
import { getPortalRoot } from '../../ui/shared/portalRoot'
import { useScrollLock } from '../../ui/shared/useScrollLock'
import { confirmDialog } from '../../ui/overlays/confirmStore'
import { previewUrl } from '../../lib/r2'
import { IconClose, IconCart, IconTrash } from '../../ui/shared/icons'

const CLOSE_ANIMATION_MS = 220

/** Vista previa del carrito — se abre desde el ícono del carrito del header
 * (en vez de navegar directo a /app/checkout) para que el biker pueda ver
 * qué lleva sin perder de vista la página en la que estaba. "Ir al
 * checkout" es la única forma de llegar a la página completa desde acá. */
export function CartDrawer() {
  const open = useCartDrawerStore((s) => s.open)
  const close = useCartDrawerStore((s) => s.closeDrawer)
  const items = useCartStore((s) => s.items)
  const remove = useCartStore((s) => s.remove)
  // El overlay muestra precios SIN la tarifa de servicio a propósito —
  // mismo criterio que el mini-carrito de Uber Eats/PedidosYa: la tarifa
  // se revela hasta el checkout completo, no aquí.
  const { photographerGroups: pricedGroups, faceTotal, discount } = useCartPricing()
  const subtotal = faceTotal - discount

  // El panel se queda MONTADO un instante más tras `open` volverse falso
  // (con la clase de salida en vez de desaparecer de golpe) — sin esto no
  // había ninguna animación de cierre, solo un `if (!open) return null`.
  const [rendered, setRendered] = useState(open)
  useEffect(() => {
    if (open) {
      setRendered(true)
      return
    }
    const timeout = setTimeout(() => setRendered(false), CLOSE_ANIMATION_MS)
    return () => clearTimeout(timeout)
  }, [open])

  // Mismo agrupado que el checkout completo (por fotógrafo → evento → punto)
  // pero ya con el precio real de cada foto (descuento por volumen de ESE
  // fotógrafo incluido) — usa `useCartPricing`, la misma fuente que usa
  // Checkout.tsx, así los dos siempre muestran el mismo número y la misma
  // jerarquía visual.
  const groups = useMemo(() => {
    return pricedGroups.map((g) => ({
      photographerId: g.photographerId,
      photographerName: g.photographerName,
      subtotal: g.subtotal,
      events: groupByEventAndPoint(g.items),
    }))
  }, [pricedGroups])

  useScrollLock(rendered)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  async function handleRemove(item: CartPricedItem) {
    const ok = await confirmDialog.ask({
      title: '¿Quitar esta foto del carrito?',
      description: `${item.eventTitle} — Q${item.effectivePrice}`,
      confirmLabel: 'Quitar',
      tone: 'danger',
    })
    if (ok) remove(item.photoId)
  }

  if (!rendered) return null

  return createPortal(
    <div className="fixed inset-0 z-[250] flex justify-end">
      <div className={`fixed inset-0 bg-black/50 ${open ? 'animate-backdrop-in' : 'animate-backdrop-out'}`} onClick={close} />
      {/* Más angosto en móvil (`w-[70%]`, antes 86%) — en escritorio no se
          toca: `sm:w-full` + `max-w-md` lo deja exactamente igual que antes
          a partir de esa resolución. */}
      <div className={`relative flex h-full w-[70%] max-w-md flex-col bg-background shadow-2xl sm:w-full ${open ? 'animate-drawer-in' : 'animate-drawer-out'}`}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5 sm:px-5 sm:py-4">
          <h2 className="flex items-center gap-2 text-base font-bold sm:text-lg">
            <IconCart className="h-5 w-5" />
            Tu carrito
            {items.length > 0 && <span className="text-sm font-normal text-muted-foreground">({items.length})</span>}
          </h2>
          <button onClick={close} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-full bg-muted hover:bg-border">
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <span className="text-4xl opacity-40">🛒</span>
              <p className="font-semibold">Tu carrito está vacío</p>
              <p className="text-sm text-muted-foreground">Agrega fotos desde cualquier búsqueda o evento.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {groups.map((group) => (
                <div key={group.photographerId}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.photographerName}</p>
                    <p className="text-xs font-semibold text-foreground">Q{group.subtotal}</p>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {/* Una tarjeta por evento SIEMPRE (no solo cuando hay más
                        de uno) — adentro, un bloque por punto (con su
                        horario) y dentro de cada punto, filas compactas en
                        grid de 2 columnas para no gastar tanto alto vertical
                        con carritos grandes. */}
                    {group.events.map((event) => (
                      <div key={event.eventId} className="rounded-2xl border border-border bg-muted/30 p-2.5">
                        <p className="mb-1.5 truncate px-1 text-xs font-medium text-muted-foreground">{event.eventTitle}</p>
                        <div className="flex flex-col gap-2">
                          {event.points.map((point) => {
                            const schedule = formatPointSchedule(point.pointTimeStart, point.pointTimeEnd)
                            return (
                              <div key={point.key}>
                                {point.pointLabel && (
                                  <p className="mb-1 truncate px-1 text-[11px] font-semibold text-foreground">
                                    {point.pointLabel}
                                    {schedule && <span className="ml-1.5 font-normal text-muted-foreground">{schedule}</span>}
                                  </p>
                                )}
                                <div className="grid grid-cols-2 gap-1.5">
                                  {point.items.map((item) => (
                                    <div key={item.photoId} className="flex items-center gap-1.5 rounded-lg bg-background p-1.5">
                                      <img
                                        src={previewUrl({ storage_path: item.storagePath, preview_path: item.previewPath })}
                                        alt=""
                                        className="h-8 w-8 shrink-0 rounded object-cover"
                                      />
                                      {/* El nombre del archivo (no el evento,
                                          que ya se lee arriba) es lo que
                                          distingue una fila de otra — dos
                                          fotos del mismo punto suelen costar
                                          lo mismo, así que solo el precio
                                          repetido no alcanza para saber cuál
                                          es cuál. */}
                                      <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{item.originalFilename ?? 'Foto'}</p>
                                      <p className="shrink-0 text-xs font-bold">Q{item.effectivePrice}</p>
                                      <button
                                        onClick={() => handleRemove(item)}
                                        aria-label="Quitar del carrito"
                                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-red-500 hover:bg-red-50 hover:text-red-600"
                                      >
                                        <IconTrash className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-border px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-lg font-bold">Q{subtotal}</span>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">+ tarifa de servicio, calculada en el checkout</p>
            <Link
              to="/app/checkout"
              onClick={close}
              className="flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Ir al checkout
            </Link>
          </div>
        )}
      </div>
    </div>,
    getPortalRoot(),
  )
}
