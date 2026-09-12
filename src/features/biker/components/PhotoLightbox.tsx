import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { previewUrl } from '../../../lib/r2'
import { useCartStore } from '../../cart/cartStore'
import { useFavoritesStore } from '../favoritesStore'
import { flyToCart } from '../../../lib/flyToCart'
import { getPortalRoot } from '../../../ui/shared/portalRoot'
import { useScrollLock } from '../../../ui/shared/useScrollLock'
import { useToastStore } from '../../../ui/overlays/toastStore'
import { createSharedLink } from '../../share/sharedLinks'
import { IconClose, IconBookmark, IconCart, IconChevronLeft, IconChevronRight, IconShare } from '../../../ui/shared/icons'
import { cn } from '../../../lib/cn'
import type { GridPhoto } from './PhotoGrid'

interface PhotoLightboxProps {
  photos: GridPhoto[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
  /** Query string de los filtros de búsqueda activos en la página que abrió
   * este visor — se guarda junto al link de "compartir" para que, si quien
   * lo recibe ya tiene sesión, la vuelva a abrir en Search.tsx con estos
   * mismos filtros (además y no solo la foto suelta). Se omite en páginas
   * sin un concepto de "filtros" propio (perfil de fotógrafo, favoritos,
   * detalle de evento) — el link sigue funcionando, solo sin filtros. */
  shareSearchParams?: string
  /** 'shop' (default): guardar/carrito/compartir/precio, como en Buscar. Se
   * usa para fotos que TODAVÍA se pueden comprar. 'purchased': fotos ya
   * compradas (Mis compras, detalle de pedido, o el pedido visto por el
   * fotógrafo) — sin guardar/carrito/compartir/precio, ya que ninguno de
   * esos botones aplica a una foto que ya cambió de manos. El caller decide
   * qué mostrar abajo a la derecha (normalmente descargar, o subir entrega)
   * vía `cornerSlot`. */
  mode?: 'shop' | 'purchased'
  cornerSlot?: React.ReactNode
  /** Por defecto se usa `previewUrl(photo)` (el preview público, con marca
   * de agua) — cuando el caller ya tiene una URL firmada mejor para esta
   * foto (ej. el archivo final ya entregado, que vive en el bucket
   * privado), puede resolverla acá y el visor la usa en su lugar. */
  resolveSrc?: (photo: GridPhoto) => string | undefined
}

const SWIPE_UP_CLOSE_THRESHOLD = 110
const SWIPE_NAV_THRESHOLD = 70
const CLOSE_ANIMATION_MS = 180
const ZOOM_MIN = 1
const ZOOM_MAX = 4

/** Visor de fotos — la foto ocupa casi toda la pantalla (solo un margen que
 * nunca deja que toque los bordes) y la info vive en las esquinas, como
 * overlays chicos que NO le quitan espacio real a la imagen — a diferencia
 * de la versión anterior (filas reales de header/footer), que sí achicaba
 * la foto para hacerle lugar. */
export function PhotoLightbox({ photos, index, onClose, onNavigate, shareSearchParams, mode = 'shop', cornerSlot, resolveSrc }: PhotoLightboxProps) {
  const purchased = mode === 'purchased'
  const photo = photos[index]
  const imgSrc = resolveSrc?.(photo) ?? previewUrl(photo)
  const imgRef = useRef<HTMLImageElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [dragX, setDragX] = useState(0)
  const [dragY, setDragY] = useState(0)
  const [saveBurstKey, setSaveBurstKey] = useState<number | null>(null)
  const [unsaveBurstKey, setUnsaveBurstKey] = useState<number | null>(null)
  const [slideDir, setSlideDir] = useState(1)
  const [closing, setClosing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const touchRef = useRef<{ startX: number; startY: number } | null>(null)
  const push = useToastStore((s) => s.push)

  const inCart = useCartStore((s) => s.has(photo.id))
  const add = useCartStore((s) => s.add)
  const remove = useCartStore((s) => s.remove)
  const isFavorite = useFavoritesStore((s) => s.has(photo.id))
  const toggleFavorite = useFavoritesStore((s) => s.toggle)

  useScrollLock(true)

  useEffect(() => {
    setZoom(1)
    setDragX(0)
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
      originalFilename: photo.original_filename,
      pointLabel: photo.pointLabel ?? null,
      pointTimeStart: photo.pointTimeStart ?? null,
      pointTimeEnd: photo.pointTimeEnd ?? null,
    })
    if (imgRef.current) flyToCart(imgRef.current.getBoundingClientRect(), previewUrl(photo))
  }

  function handleToggleFavorite() {
    const next = !isFavorite
    toggleFavorite(photo.id)
    if (next) setSaveBurstKey((k) => (k ?? 0) + 1)
    else setUnsaveBurstKey((k) => (k ?? 0) + 1)
  }

  // Crea un link corto (`/f/<code>`) apuntando a esta foto + los filtros de
  // búsqueda activos, y lo entrega usando lo que el navegador tenga a mano:
  // en móvil, `navigator.share` abre el panel nativo del sistema (WhatsApp,
  // Instagram, lo que sea que el usuario tenga instalado); en escritorio
  // (sin esa API) el respaldo es copiar el link al portapapeles.
  async function handleShare() {
    if (sharing) return
    setSharing(true)
    try {
      const code = await createSharedLink(photo.id, shareSearchParams ?? '')
      const url = `${window.location.origin}/f/${code}`
      const text = `Mira esta foto de ${photo.eventTitle} en MotoShots 🏍️📸`
      if (navigator.share) {
        try {
          await navigator.share({ title: 'MotoShots', text, url })
        } catch {
          // AbortError si la persona cierra el panel nativo sin elegir nada
          // — no es un error real, no hay nada que avisar.
        }
      } else {
        await navigator.clipboard.writeText(url)
        push({ type: 'success', title: 'Enlace copiado', description: 'Pégalo donde quieras compartirlo.' })
      }
    } catch (err) {
      push({ type: 'error', title: 'No se pudo crear el enlace', description: (err as Error).message })
    } finally {
      setSharing(false)
    }
  }

  // Zoom con scroll/rueda — React registra los listeners de `wheel` como
  // PASIVOS por defecto (para no trabar el scroll de la página en general),
  // así que un `onWheel` normal no puede llamar `preventDefault()` sin que
  // el navegador tire un error/advertencia. Hace falta un listener nativo
  // agregado a mano con `{ passive: false }` para poder frenar el scroll de
  // la página mientras se hace zoom sobre la foto.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z - e.deltaY * 0.0015)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Gestos táctiles: un dedo desliza (izq/der cambia de foto, arriba
  // cierra — abajo se dejó de usar porque el navegador lo confunde con
  // "recargar la página"). El zoom de dos dedos (pellizcar) se DESACTIVÓ a
  // propósito: interfería con el zoom nativo del navegador en móvil y
  // producía un glitch visual — en el teléfono el zoom vive solo en los
  // botones +/- del visor (ver el resizer más abajo); acá solo queda el
  // gesto de un dedo.
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1 || zoom > 1) return
    touchRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY }
  }

  function onTouchMove(e: React.TouchEvent) {
    const t = touchRef.current
    if (!t || e.touches.length !== 1) return
    const dx = e.touches[0].clientX - t.startX
    const dy = e.touches[0].clientY - t.startY
    if (Math.abs(dx) > Math.abs(dy)) {
      setDragX(dx)
      setDragY(0)
    } else if (dy < 0) {
      // Solo hacia ARRIBA cierra — hacia abajo se ignora a propósito
      // (en el navegador, deslizar hacia abajo desde arriba de la
      // página se confunde con "recargar", con o sin scroll-lock).
      setDragY(dy)
      setDragX(0)
    }
  }

  function onTouchEnd() {
    if (touchRef.current) {
      if (dragY < -SWIPE_UP_CLOSE_THRESHOLD) {
        requestClose()
      } else if (dragX < -SWIPE_NAV_THRESHOLD) {
        go(1)
      } else if (dragX > SWIPE_NAV_THRESHOLD) {
        go(-1)
      }
    }
    touchRef.current = null
    setDragX(0)
    setDragY(0)
  }

  const backdropOpacity = dragY < 0 ? Math.max(0.3, 1 - Math.abs(dragY) / 400) : 1

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
        ref={stageRef}
        className="flex h-full w-full items-center justify-center p-6 sm:p-12"
        onClick={(e) => {
          if (e.target === e.currentTarget) requestClose()
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div key={photo.id} className="animate-lightbox-slide" style={{ '--slide-dir': slideDir } as React.CSSProperties}>
          <img
            ref={imgRef}
            src={imgSrc}
            alt={photo.eventTitle}
            className="max-h-[calc(100vh-3rem)] max-w-[calc(100vw-3rem)] select-none object-contain transition-transform duration-150 sm:max-h-[calc(100vh-6rem)] sm:max-w-[calc(100vw-6rem)]"
            style={{ transform: `scale(${zoom}) translate(${dragX}px, ${dragY}px)` }}
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
        <div className="pointer-events-auto grid max-w-[55vw] grid-cols-[auto_1fr] items-baseline gap-x-1.5 gap-y-0.5 rounded-xl bg-black/40 px-2.5 py-2 text-[11px] text-white backdrop-blur-sm sm:max-w-xs sm:gap-y-1 sm:rounded-2xl sm:px-3.5 sm:py-2.5 sm:text-sm">
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
        {!purchased && (
          <button
            onClick={handleShare}
            disabled={sharing}
            aria-label="Compartir esta foto"
            title="Compartir"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 disabled:opacity-50"
          >
            {sharing ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <IconShare className="h-4 w-4" />}
          </button>
        )}
        <span className="rounded-full bg-black/40 px-3 py-1.5 text-[11px] text-white/70 backdrop-blur-sm sm:text-sm">
          {index + 1} / {photos.length}
        </span>
        <button onClick={requestClose} aria-label="Cerrar" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60">
          <IconClose className="h-4 w-4" />
        </button>
      </div>

      {/* Esquina inferior derecha: en modo compra, precio + guardar +
          carrito; en modo "ya comprada", lo que el caller necesite (ej.
          descargar, o subir entrega final) vía `cornerSlot` — ninguno de
          los botones de compra aplica ahí. */}
      {purchased ? (
        cornerSlot && <div className="absolute bottom-4 right-4 z-10 sm:bottom-6 sm:right-6">{cornerSlot}</div>
      ) : (
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
                aria-label={inCart ? 'Quitar del carrito' : 'Agregar al carrito'}
                className={cn(
                  // Blanco por defecto, azul relleno una vez agregada — mismo
                  // criterio que la miniatura de la grilla (PhotoCard.tsx).
                  'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                  // `sm:hover:` (no `hover:` a secas) — mismo motivo que en
                  // PhotoCard.tsx: en móvil el :hover pegajoso tras un toque
                  // se veía igual que "ya agregada" (mismo azul).
                  inCart ? 'bg-primary text-white' : 'bg-white text-black sm:hover:bg-primary sm:hover:text-white',
                )}
              >
                <IconCart className="h-4 w-4" filled={inCart} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Flechas prev/siguiente — antes solo en escritorio; ahora también en
          móvil (además del gesto de deslizar), ya que el pellizcar para
          zoom se desactivó ahí y conviene dejar una forma de navegar con
          un toque sin depender solo del gesto. */}
      {index > 0 && (
        <button
          onClick={() => go(-1)}
          aria-label="Foto anterior"
          className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 sm:left-4 sm:h-12 sm:w-12"
        >
          <IconChevronLeft className="h-5 w-5" />
        </button>
      )}
      {index < photos.length - 1 && (
        <button
          onClick={() => go(1)}
          aria-label="Foto siguiente"
          className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 sm:right-4 sm:h-12 sm:w-12"
        >
          <IconChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>,
    getPortalRoot(),
  )
}
