import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { previewUrl } from '../../../lib/r2'
import { useCartStore } from '../../cart/cartStore'
import { useFavoritesStore } from '../favoritesStore'
import { Button } from '../../../ui/flat/Button'
import { cn } from '../../../lib/cn'
import type { GridPhoto } from './PhotoGrid'

interface PhotoLightboxProps {
  photos: GridPhoto[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

export function PhotoLightbox({ photos, index, onClose, onNavigate }: PhotoLightboxProps) {
  const photo = photos[index]
  const filmstripRef = useRef<HTMLDivElement>(null)

  const inCart = useCartStore((s) => (photo ? s.has(photo.id) : false))
  const add = useCartStore((s) => s.add)
  const remove = useCartStore((s) => s.remove)
  const isFavorite = useFavoritesStore((s) => (photo ? s.has(photo.id) : false))
  const toggleFavorite = useFavoritesStore((s) => s.toggle)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && index < photos.length - 1) onNavigate(index + 1)
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, photos.length, onClose, onNavigate])

  useEffect(() => {
    const active = filmstripRef.current?.children[index] as HTMLElement | undefined
    active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [index])

  if (!photo) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 font-flat">
      <div className="flex items-center justify-between px-4 py-3 text-white sm:px-6">
        <div className="min-w-0">
          <p className="truncate font-semibold">{photo.eventTitle}</p>
          <Link to={`/app/fotografos/${photo.photographer_id}`} className="text-sm text-white/70 hover:text-white">
            {photo.photographerName}
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm text-white/60">{index + 1} / {photos.length}</span>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg hover:bg-white/20">
            ✕
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4">
        {index > 0 && (
          <button
            onClick={() => onNavigate(index - 1)}
            className="absolute left-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20 sm:left-6"
          >
            ‹
          </button>
        )}
        <img
          key={photo.id}
          src={previewUrl(photo)}
          alt={photo.eventTitle}
          className="max-h-full max-w-full animate-[lightbox-in_.25s_ease-out] rounded-lg object-contain shadow-2xl"
        />
        {index < photos.length - 1 && (
          <button
            onClick={() => onNavigate(index + 1)}
            className="absolute right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20 sm:right-6"
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
              'h-14 w-11 shrink-0 overflow-hidden rounded-md transition-all duration-150',
              i === index ? 'opacity-100 ring-2 ring-white' : 'opacity-40 hover:opacity-75',
            )}
          >
            <img src={previewUrl(p)} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">Q{photo.price}</span>
          {photo.moto_brand && <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70">{photo.moto_brand}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleFavorite(photo.id)}
            className={cn('flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-lg hover:bg-white/20', isFavorite && 'text-red-500')}
            aria-label="Favorito"
          >
            {isFavorite ? '♥' : '♡'}
          </button>
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
        </div>
      </div>
    </div>,
    document.body,
  )
}
