import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import type { Photo } from '../../../data/mockPhotos'
import { thumbUrl, getEventById, getPhotographerById } from '../../../data/mockPhotos'
import { useCartStore } from '../../cart/cartStore'
import { useFavoritesStore } from '../favoritesStore'
import { Button } from '../../../ui/flat/Button'
import { cn } from '../../../lib/cn'

interface PhotoLightboxProps {
  photos: Photo[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

export function PhotoLightbox({ photos, index, onClose, onNavigate }: PhotoLightboxProps) {
  const photo = photos[index]
  const event = photo ? getEventById(photo.eventId) : undefined
  const photographer = photo ? getPhotographerById(photo.photographerId) : undefined

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

  if (!photo) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 font-flat">
      <div className="flex items-center justify-between px-4 py-3 text-white sm:px-6">
        <div className="min-w-0">
          <p className="truncate font-semibold">{event?.title}</p>
          {photographer && (
            <Link to={`/app/fotografos/${photographer.id}`} className="text-sm text-white/70 hover:text-white">
              {photographer.name}
            </Link>
          )}
        </div>
        <button onClick={onClose} className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg hover:bg-white/20">
          ✕
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4">
        {index > 0 && (
          <button
            onClick={() => onNavigate(index - 1)}
            className="absolute left-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20 sm:left-6"
          >
            ‹
          </button>
        )}
        <img src={thumbUrl(photo.seed, 1000, 1250)} alt={event?.title} className="max-h-full max-w-full rounded-lg object-contain" />
        {index < photos.length - 1 && (
          <button
            onClick={() => onNavigate(index + 1)}
            className="absolute right-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20 sm:right-6"
          >
            ›
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">Q{photo.price}</span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70">{photo.motoBrand}</span>
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
                : add({ photoId: photo.id, eventId: photo.eventId, eventTitle: event?.title ?? '', photographerName: photographer?.name ?? '', price: photo.price, seed: photo.seed })
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
