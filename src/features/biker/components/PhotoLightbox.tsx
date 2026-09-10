import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { previewUrl } from '../../../lib/r2'
import { useCartStore } from '../../cart/cartStore'
import { useFavoritesStore } from '../favoritesStore'
import { flyToCart } from '../../../lib/flyToCart'
import { getPortalRoot } from '../../../ui/shared/portalRoot'
import { useScrollLock } from '../../../ui/shared/useScrollLock'
import { IconClose, IconBookmark, IconCart, IconChevronLeft, IconChevronRight } from '../../../ui/shared/icons'
import { cn } from '../../../lib/cn'
import type { GridPhoto } from './PhotoGrid'

interface PhotoLightboxProps {
  photos: GridPhoto[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

const SWIPE_DOWN_CLOSE_THRESHOLD = 120

/** Visor de fotos — reescrito desde cero (antes usaba `yet-another-react-
 * lightbox` con overlays absolutos para el header/footer). El bug real:
 * esa librería reservaba espacio para el carrusel de miniaturas por fuera
 * del cálculo de alto de la imagen, y como el footer de precio/guardar/
 * carrito vivía `position: absolute` ENCIMA de la imagen (no en el layout
 * real), terminaba tapando su borde inferior mientras, a la vez, la imagen
 * no llenaba el resto del alto disponible. Acá el header y el footer son
 * filas de verdad dentro de un `flex flex-col` — la imagen ocupa
 * exactamente el espacio que sobra (`flex-1`), nunca se recorta ni queda
 * tapada, y no hay forma de que el header/footer se superpongan entre sí
 * porque cada uno es su propia fila. */
export function PhotoLightbox({ photos, index, onClose, onNavigate }: PhotoLightboxProps) {
  const photo = photos[index]
  const imgRef = useRef<HTMLImageElement>(null)
  const [zoomed, setZoomed] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [saveBurstKey, setSaveBurstKey] = useState<number | null>(null)
  const draggingRef = useRef<{ startY: number; active: boolean } | null>(null)

  const inCart = useCartStore((s) => s.has(photo.id))
  const add = useCartStore((s) => s.add)
  const remove = useCartStore((s) => s.remove)
  const isFavorite = useFavoritesStore((s) => s.has(photo.id))
  const toggleFavorite = useFavoritesStore((s) => s.toggle)

  useScrollLock(true)

  useEffect(() => {
    setZoomed(false)
    setDragY(0)
  }, [index])

  function go(delta: number) {
    const next = index + delta
    if (next >= 0 && next < photos.length) onNavigate(next)
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, photos.length])

  function handleAdd() {
    if (inCart) {
      remove(photo.id)
      return
    }
    add({
      photoId: photo.id,
      eventId: photo.event_id,
      eventTitle: photo.eventTitle,
      photographerId: photo.photographer_id,
      photographerName: photo.photographerName,
      price: photo.price,
      storagePath: photo.storage_path,
      previewPath: photo.preview_path,
    })
    if (imgRef.current) flyToCart(imgRef.current.getBoundingClientRect(), previewUrl(photo))
  }

  function handleToggleFavorite() {
    const next = !isFavorite
    toggleFavorite(photo.id)
    if (next) setSaveBurstKey((k) => (k ?? 0) + 1)
  }

  // Deslizar hacia abajo para cerrar (móvil) — solo si la foto no está
  // ampliada (con zoom, ese gesto vertical se necesita para recorrer la
  // imagen, no para cerrar el visor).
  function onTouchStart(e: React.TouchEvent) {
    if (zoomed) return
    draggingRef.current = { startY: e.touches[0].clientY, active: true }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!draggingRef.current?.active) return
    const delta = e.touches[0].clientY - draggingRef.current.startY
    if (delta > 0) setDragY(delta)
  }
  function onTouchEnd() {
    if (dragY > SWIPE_DOWN_CLOSE_THRESHOLD) onClose()
    else setDragY(0)
    draggingRef.current = null
  }

  const backdropOpacity = dragY > 0 ? Math.max(0.3, 1 - dragY / 400) : 1

  return createPortal(
    <div className="fixed inset-0 z-[300] flex flex-col bg-black animate-backdrop-in" style={{ backgroundColor: `rgba(0,0,0,${backdropOpacity})` }}>
      {/* Cabecera: info de la foto a la izquierda (con etiquetas, para que
          quede claro qué es cada dato) y contador + cerrar a la derecha —
          fila real, nunca se superponen entre sí. */}
      <div className="flex items-start justify-between gap-4 px-4 py-3 text-white sm:px-6 sm:py-4">
        <div className="min-w-0 space-y-0.5 text-sm">
          <p className="truncate">
            <span className="text-white/40">Fotógrafo: </span>
            <Link to={`/app/fotografos/${photo.photographer_id}`} className="font-medium hover:underline">
              {photo.photographerName}
            </Link>
          </p>
          <p className="truncate">
            <span className="text-white/40">Evento: </span>
            <span className="font-medium">{photo.eventTitle}</span>
          </p>
          {photo.pointLabel && (
            <p className="truncate">
              <span className="text-white/40">Punto: </span>
              <span className="font-medium">{photo.pointLabel}</span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm text-white/50">
            {index + 1} / {photos.length}
          </span>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20">
            <IconClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Imagen — ocupa exactamente el espacio que sobra entre header y
          footer (`flex-1`), nunca se recorta. Click fuera de la imagen (en
          el fondo) cierra el visor; click sobre la imagen alterna zoom. */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-2"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {index > 0 && (
          <button
            onClick={() => go(-1)}
            aria-label="Foto anterior"
            className="absolute left-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:flex"
          >
            <IconChevronLeft className="h-5 w-5" />
          </button>
        )}

        <img
          ref={imgRef}
          src={previewUrl(photo)}
          alt={photo.eventTitle}
          className={cn(
            'max-h-full max-w-full select-none object-contain transition-transform duration-300',
            zoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in',
          )}
          style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
          onClick={(e) => {
            e.stopPropagation()
            setZoomed((z) => !z)
          }}
        />

        {saveBurstKey !== null && (
          <div
            key={saveBurstKey}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            onAnimationEnd={() => setSaveBurstKey(null)}
          >
            <IconBookmark filled className="h-20 w-20 animate-save-burst text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]" />
          </div>
        )}

        {index < photos.length - 1 && (
          <button
            onClick={() => go(1)}
            aria-label="Foto siguiente"
            className="absolute right-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:flex"
          >
            <IconChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Pie: precio + acciones — fila real debajo de la imagen, nunca
          encima de ella. */}
      <div className="px-4 pb-4 pt-2 sm:px-6 sm:pb-6">
        <div className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-3.5 backdrop-blur-md">
          {photo.featured ? (
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-black">★ Foto destacada</span>
              <p className="mt-1 text-xs text-white/50">No está a la venta — es parte del portafolio del fotógrafo.</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-white">Q{photo.price}</span>
                {photo.moto_brand && <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70">{photo.moto_brand}</span>}
              </div>
              <p className="mt-0.5 text-xs text-white/50">Con marca de agua — el original llega sin marca al comprar.</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleFavorite}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Guardar"
            >
              <IconBookmark className="h-5 w-5" filled={isFavorite} />
            </button>
            {!photo.featured && (
              <button
                onClick={handleAdd}
                className={cn(
                  'flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors',
                  inCart ? 'bg-secondary text-white' : 'bg-white text-black hover:bg-primary hover:text-white',
                )}
              >
                {inCart ? (
                  '✓ En el carrito'
                ) : (
                  <>
                    <IconCart className="h-4 w-4" /> Agregar
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    getPortalRoot(),
  )
}
