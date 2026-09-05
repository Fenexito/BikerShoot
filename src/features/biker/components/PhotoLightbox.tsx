import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { previewUrl } from '../../../lib/r2'
import { useCartStore } from '../../cart/cartStore'
import { useFavoritesStore } from '../favoritesStore'
import { Button } from '../../../ui/flat/Button'
import { IconBookmark } from '../../../ui/shared/icons'
import { cn } from '../../../lib/cn'
import type { GridPhoto } from './PhotoGrid'

interface PhotoLightboxProps {
  photos: GridPhoto[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.5

export function PhotoLightbox({ photos, index, onClose, onNavigate }: PhotoLightboxProps) {
  const photo = photos[index]
  const filmstripRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)

  const inCart = useCartStore((s) => (photo ? s.has(photo.id) : false))
  const add = useCartStore((s) => s.add)
  const remove = useCartStore((s) => s.remove)
  const isFavorite = useFavoritesStore((s) => (photo ? s.has(photo.id) : false))
  const toggleFavorite = useFavoritesStore((s) => s.toggle)

  useEffect(() => {
    setZoom(1)
  }, [photo?.id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && index < photos.length - 1) onNavigate(index + 1)
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))
      if (e.key === '-') setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, photos.length, onClose, onNavigate])

  useEffect(() => {
    const active = filmstripRef.current?.children[index] as HTMLElement | undefined
    active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [index])

  function onWheelZoom(e: React.WheelEvent) {
    e.preventDefault()
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.0015 * ZOOM_STEP * 4)))
  }

  if (!photo) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 font-flat">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-white sm:px-6">
        <div className="min-w-0">
          <p className="truncate font-semibold">{photo.eventTitle}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-white/70">
            <Link to={`/app/fotografos/${photo.photographer_id}`} className="hover:text-white">
              {photo.photographerName}
            </Link>
            {photo.pointLabel && <span>· 📍 {photo.pointLabel}</span>}
          </div>
          {photo.original_filename && <p className="mt-0.5 truncate text-xs text-white/40">{photo.original_filename}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-1.5 py-1">
            <button
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
              aria-label="Alejar"
              className="flex h-8 w-8 items-center justify-center rounded-full text-base hover:bg-white/10"
            >
              −
            </button>
            <button onClick={() => setZoom(1)} className="min-w-[3rem] rounded-full px-1 py-1 text-center text-xs font-semibold hover:bg-white/10">
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
              aria-label="Acercar"
              className="flex h-8 w-8 items-center justify-center rounded-full text-base hover:bg-white/10"
            >
              +
            </button>
          </div>
          <span className="text-sm text-white/60">{index + 1} / {photos.length}</span>
          <button onClick={onClose} aria-label="Cerrar visor" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-lg hover:bg-white/20">
            ✕
          </button>
        </div>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-auto px-4"
        onWheel={onWheelZoom}
      >
        {index > 0 && (
          <button
            onClick={() => onNavigate(index - 1)}
            aria-label="Foto anterior"
            className="fixed left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20 sm:left-6"
          >
            ‹
          </button>
        )}
        <div className="flex min-h-full w-full items-center justify-center py-4">
          <img
            key={photo.id}
            src={previewUrl(photo)}
            alt={photo.eventTitle}
            style={zoom > 1 ? { width: `${zoom * 100}%`, maxWidth: 'none' } : undefined}
            className={cn(
              'animate-[lightbox-in_.25s_ease-out] rounded-2xl object-contain shadow-2xl',
              zoom === 1 && 'max-h-[75vh] max-w-full',
            )}
          />
        </div>
        {index < photos.length - 1 && (
          <button
            onClick={() => onNavigate(index + 1)}
            aria-label="Foto siguiente"
            className="fixed right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20 sm:right-6"
          >
            ›
          </button>
        )}
      </div>

      <div ref={filmstripRef} className="flex gap-2 overflow-x-auto px-4 pb-3 pt-1 sm:px-6">
        {photos.map((p, i) => (
          <button
            key={p.id}
            onClick={() => onNavigate(i)}
            className={cn(
              'h-14 w-11 shrink-0 overflow-hidden rounded-xl transition-all duration-150',
              i === index ? 'opacity-100 ring-2 ring-white' : 'opacity-40 hover:opacity-75',
            )}
          >
            <img src={previewUrl(p)} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {/* Barra flotante de acciones, tipo Mobbin — no un bloque pegado al
          borde inferior, sino una tarjeta redondeada centrada. Las fotos
          destacadas no están a la venta: sin precio, sin carrito. */}
      <div className="flex justify-center px-4 pb-5 pt-1 sm:px-6">
        <div className="flex w-full max-w-xl flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-3.5 backdrop-blur-md">
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
              onClick={() => toggleFavorite(photo.id)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Guardar"
            >
              <IconBookmark className="h-5 w-5" filled={isFavorite} />
            </button>
            {!photo.featured && (
              <Button
                onClick={() =>
                  inCart
                    ? remove(photo.id)
                    : add({ photoId: photo.id, eventId: photo.event_id, eventTitle: photo.eventTitle, photographerId: photo.photographer_id, photographerName: photo.photographerName, price: photo.price, storagePath: photo.storage_path, previewPath: photo.preview_path })
                }
                variant={inCart ? 'secondary' : 'primary'}
              >
                {inCart ? '✓ En el carrito' : 'Agregar al carrito'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
