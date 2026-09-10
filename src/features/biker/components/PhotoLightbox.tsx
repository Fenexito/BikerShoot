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
const CLOSE_ANIMATION_MS = 180
const ZOOM_MIN = 1
const ZOOM_MAX = 4

/** Visor de fotos — la foto ocupa casi toda la pantalla (solo un margen que
 * nunca deja que toque los bordes) y la info vive en las esquinas, como
 * overlays chicos que NO le quitan espacio real a la imagen — a diferencia
 * de la versión anterior (filas reales de header/footer), que sí achicaba
 * la foto para hacerle lugar. */
export function PhotoLightbox({ photos, index, onClose, onNavigate }: PhotoLightboxProps) {
  const photo = photos[index]
  const imgRef = useRef<HTMLImageElement>(null)
  const [zoom, setZoom] = useState(1)
  const [dragY, setDragY] = useState(0)
  const [saveBurstKey, setSaveBurstKey] = useState<number | null>(null)
  const [unsaveBurstKey, setUnsaveBurstKey] = useState<number | null>(null)
  const [slideDir, setSlideDir] = useState(1)
  const [closing, setClosing] = useState(false)
  const draggingRef = useRef<{ startY: number } | null>(null)

  const inCart = useCartStore((s) => s.has(photo.id))
  const add = useCartStore((s) => s.add)
  const remove = useCartStore((s) => s.remove)
  const isFavorite = useFavoritesStore((s) => s.has(photo.id))
  const toggleFavorite = useFavoritesStore((s) => s.toggle)

  useScrollLock(true)

  useEffect(() => {
    setZoom(1)
    setDragY(0)
  }, [index])

  function requestClose() {
    setClosing(true)
    setTimeout(onClose, CLOSE_ANIMATION_MS)
  }

  function go(delta: number) {
    const next = index + delta
    if (next < 0 || next >= photos.length) return
    setSlideDir(delta > 0 ? 1 : -1)
    onNavigate(next)
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose()
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
    else setUnsaveBurstKey((k) => (k ?? 0) + 1)
  }

  // Zoom con scroll/rueda (no con click) — mientras la foto está ampliada,
  // el gesto vertical de deslizar sigue siendo el zoom, no el cierre.
  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z - e.deltaY * 0.0015)))
  }

  // Deslizar hacia abajo para cerrar (móvil) — solo si la foto no está
  // ampliada.
  function onTouchStart(e: React.TouchEvent) {
    if (zoom > 1) return
    draggingRef.current = { startY: e.touches[0].clientY }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!draggingRef.current) return
    const delta = e.touches[0].clientY - draggingRef.current.startY
    if (delta > 0) setDragY(delta)
  }
  function onTouchEnd() {
    if (dragY > SWIPE_DOWN_CLOSE_THRESHOLD) requestClose()
    else setDragY(0)
    draggingRef.current = null
  }

  const backdropOpacity = dragY > 0 ? Math.max(0.3, 1 - dragY / 400) : 1

  return createPortal(
    <div
      className={cn('fixed inset-0 z-[300]', closing ? 'animate-lightbox-out' : 'animate-lightbox-in')}
      style={{ backgroundColor: `rgba(10,10,10,${backdropOpacity})` }}
    >
      {/* Imagen — casi toda la pantalla, con un margen que nunca deja que
          toque los bordes (vertical arriba/abajo, horizontal a los
          costados, según la orientación de cada foto — `object-contain`
          dentro de un padding fijo resuelve ambos casos solo). Click fuera
          de la imagen cierra el visor; la rueda/scroll hace zoom. */}
      <div
        className="flex h-full w-full items-center justify-center p-6 sm:p-12"
        onClick={(e) => {
          if (e.target === e.currentTarget) requestClose()
        }}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div key={photo.id} className="animate-lightbox-slide" style={{ '--slide-dir': slideDir } as React.CSSProperties}>
          <img
            ref={imgRef}
            src={previewUrl(photo)}
            alt={photo.eventTitle}
            className="max-h-[calc(100vh-3rem)] max-w-[calc(100vw-3rem)] select-none object-contain transition-transform duration-150 sm:max-h-[calc(100vh-6rem)] sm:max-w-[calc(100vw-6rem)]"
            style={{ transform: `scale(${zoom}) translateY(${dragY / zoom}px)` }}
            draggable={false}
          />
        </div>

        {saveBurstKey !== null && (
          <div key={`save-${saveBurstKey}`} className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" onAnimationEnd={() => setSaveBurstKey(null)}>
            <IconBookmark filled className="h-20 w-20 animate-save-burst text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]" />
          </div>
        )}
        {unsaveBurstKey !== null && (
          <div
            key={`unsave-${unsaveBurstKey}`}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            onAnimationEnd={() => setUnsaveBurstKey(null)}
          >
            <div className="relative h-20 w-20 drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
              <IconBookmark filled className="absolute inset-0 h-20 w-20 animate-unsave-break-left text-white" style={{ clipPath: 'inset(0 50% 0 0)' }} />
              <IconBookmark filled className="absolute inset-0 h-20 w-20 animate-unsave-break-right text-white" style={{ clipPath: 'inset(0 0 0 50%)' }} />
            </div>
          </div>
        )}
      </div>

      {/* Esquina superior izquierda: info con etiquetas alineadas a los ":"
          — grid de 2 columnas, la primera se ajusta sola al ancho de la
          etiqueta más larga, así todas quedan en la misma línea vertical. */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 sm:left-6 sm:top-6">
        <div className="pointer-events-auto grid max-w-[65vw] grid-cols-[auto_1fr] items-baseline gap-x-1.5 gap-y-1 rounded-2xl bg-black/40 px-3.5 py-2.5 text-sm text-white backdrop-blur-sm sm:max-w-xs">
          <span className="text-white/50">Fotógrafo:</span>
          <Link to={`/app/fotografos/${photo.photographer_id}`} className="min-w-0 truncate font-medium hover:underline">
            {photo.photographerName}
          </Link>
          <span className="text-white/50">Evento:</span>
          <span className="min-w-0 truncate font-medium">{photo.eventTitle}</span>
          {photo.pointLabel && (
            <>
              <span className="text-white/50">Punto:</span>
              <span className="min-w-0 truncate font-medium">{photo.pointLabel}</span>
            </>
          )}
        </div>
      </div>

      {/* Esquina superior derecha: contador + cerrar — nunca se
          superponen, cada uno es su propio elemento en la misma fila. */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-3 sm:right-6 sm:top-6">
        <span className="rounded-full bg-black/40 px-3 py-1.5 text-sm text-white/70 backdrop-blur-sm">
          {index + 1} / {photos.length}
        </span>
        <button onClick={requestClose} aria-label="Cerrar" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60">
          <IconClose className="h-4 w-4" />
        </button>
      </div>

      {/* Esquina inferior derecha: precio + guardar + carrito. */}
      <div className="absolute bottom-4 right-4 z-10 sm:bottom-6 sm:right-6">
        <div className="flex items-center gap-2 rounded-2xl bg-black/40 p-2 backdrop-blur-sm">
          {photo.featured ? (
            <span className="px-2 text-xs font-semibold text-amber-300">★ Destacada</span>
          ) : (
            <span className="px-2 text-base font-bold text-white">Q{photo.price}</span>
          )}
          <button
            onClick={handleToggleFavorite}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Guardar"
          >
            <IconBookmark className="h-4 w-4" filled={isFavorite} />
          </button>
          {!photo.featured && (
            <button
              onClick={handleAdd}
              className={cn(
                'flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors',
                inCart ? 'bg-secondary text-white' : 'bg-white text-black hover:bg-primary hover:text-white',
              )}
            >
              {inCart ? (
                '✓'
              ) : (
                <>
                  <IconCart className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Flechas prev/siguiente — escritorio únicamente (en móvil se navega
          deslizando el carrusel de miniaturas o volviendo a la grilla). */}
      {index > 0 && (
        <button
          onClick={() => go(-1)}
          aria-label="Foto anterior"
          className="absolute left-4 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 sm:flex"
        >
          <IconChevronLeft className="h-5 w-5" />
        </button>
      )}
      {index < photos.length - 1 && (
        <button
          onClick={() => go(1)}
          aria-label="Foto siguiente"
          className="absolute right-4 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 sm:flex"
        >
          <IconChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>,
    getPortalRoot(),
  )
}
