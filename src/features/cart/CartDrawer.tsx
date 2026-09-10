import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useCartStore, type CartItem } from './cartStore'
import { useCartDrawerStore } from './cartDrawerStore'
import { getPortalRoot } from '../../ui/shared/portalRoot'
import { useScrollLock } from '../../ui/shared/useScrollLock'
import { previewUrl } from '../../lib/r2'
import { IconClose, IconCart, IconTrash } from '../../ui/shared/icons'

/** Vista previa del carrito — se abre desde el ícono del carrito del header
 * (en vez de navegar directo a /app/checkout) para que el biker pueda ver
 * qué lleva sin perder de vista la página en la que estaba. "Ir al
 * checkout" es la única forma de llegar a la página completa desde acá. */
export function CartDrawer() {
  const open = useCartDrawerStore((s) => s.open)
  const close = useCartDrawerStore((s) => s.closeDrawer)
  const items = useCartStore((s) => s.items)
  const remove = useCartStore((s) => s.remove)
  const total = useCartStore((s) => s.total())

  // Agrupado por fotógrafo (sin importar el evento) y, dentro de cada
  // fotógrafo, por evento — así el biker ve de un vistazo cuánto lleva de
  // cada quien, sin que fotos del mismo fotógrafo en eventos distintos
  // queden mezcladas sin orden.
  const groups = useMemo(() => {
    const byPhotographer = new Map<string, { photographerName: string; byEvent: Map<string, { eventTitle: string; items: CartItem[] }> }>()
    for (const item of items) {
      let photographerGroup = byPhotographer.get(item.photographerId)
      if (!photographerGroup) {
        photographerGroup = { photographerName: item.photographerName, byEvent: new Map() }
        byPhotographer.set(item.photographerId, photographerGroup)
      }
      let eventGroup = photographerGroup.byEvent.get(item.eventId)
      if (!eventGroup) {
        eventGroup = { eventTitle: item.eventTitle, items: [] }
        photographerGroup.byEvent.set(item.eventId, eventGroup)
      }
      eventGroup.items.push(item)
    }
    return Array.from(byPhotographer.entries()).map(([photographerId, g]) => ({
      photographerId,
      photographerName: g.photographerName,
      events: Array.from(g.byEvent.entries()).map(([eventId, e]) => ({ eventId, eventTitle: e.eventTitle, items: e.items })),
    }))
  }, [items])

  useScrollLock(open)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[250] flex justify-end">
      <div className="fixed inset-0 bg-black/50 animate-backdrop-in" onClick={close} />
      <div className="relative flex h-full w-full max-w-md animate-drawer-in flex-col bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <IconCart className="h-5 w-5" />
            Tu carrito
            {items.length > 0 && <span className="text-sm font-normal text-muted-foreground">({items.length})</span>}
          </h2>
          <button onClick={close} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-full bg-muted hover:bg-border">
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <span className="text-4xl opacity-40">🛒</span>
              <p className="font-semibold">Tu carrito está vacío</p>
              <p className="text-sm text-muted-foreground">Agrega fotos desde cualquier búsqueda o evento.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {groups.map((group) => (
                <div key={group.photographerId}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.photographerName}</p>
                  <div className="flex flex-col gap-4">
                    {group.events.map((event) => (
                      <div key={event.eventId}>
                        {group.events.length > 1 && <p className="mb-1.5 truncate text-xs font-medium text-muted-foreground">{event.eventTitle}</p>}
                        <div className="flex flex-col gap-2">
                          {event.items.map((item) => (
                            <div key={item.photoId} className="flex items-center gap-3 rounded-2xl border border-border p-2">
                              <img
                                src={previewUrl({ storage_path: item.storagePath, preview_path: item.previewPath })}
                                alt=""
                                className="h-14 w-14 shrink-0 rounded-xl object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{event.eventTitle}</p>
                                <p className="truncate text-xs text-muted-foreground">{item.photographerName}</p>
                              </div>
                              <p className="shrink-0 text-sm font-bold">Q{item.price}</p>
                              <button
                                onClick={() => remove(item.photoId)}
                                aria-label="Quitar del carrito"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-500 hover:bg-red-50 hover:text-red-600"
                              >
                                <IconTrash className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
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
          <div className="border-t border-border px-5 py-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-lg font-bold">Q{total}</span>
            </div>
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
