import type { DbPhoto } from '../../../types/db'
import { previewUrl } from '../../../lib/r2'
import { useCartStore } from '../../cart/cartStore'
import { useFavoritesStore } from '../favoritesStore'
import { timeAgo } from '../../../lib/timeAgo'
import { cn } from '../../../lib/cn'

interface PhotoCardProps {
  photo: DbPhoto
  eventTitle: string
  photographerName: string
  onOpen: () => void
  layout?: 'grid' | 'mosaic'
}

export function PhotoCard({ photo, eventTitle, photographerName, onOpen, layout = 'grid' }: PhotoCardProps) {
  const inCart = useCartStore((s) => s.has(photo.id))
  const add = useCartStore((s) => s.add)
  const remove = useCartStore((s) => s.remove)
  const isFavorite = useFavoritesStore((s) => s.has(photo.id))
  const toggleFavorite = useFavoritesStore((s) => s.toggle)
  const freshness = timeAgo(photo.created_at)

  return (
    <div className={cn('group relative overflow-hidden rounded-lg bg-muted', layout === 'mosaic' && 'mb-3 break-inside-avoid')}>
      <button onClick={onOpen} className="block w-full">
        <img
          src={previewUrl(photo)}
          alt={`Foto de ${eventTitle}`}
          loading="lazy"
          className={cn(
            'w-full object-cover transition-transform duration-500 group-hover:scale-105',
            layout === 'mosaic' ? 'h-auto' : 'aspect-[4/5]',
          )}
        />
      </button>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      <button
        onClick={() => toggleFavorite(photo.id)}
        aria-label="Favorito"
        className={cn(
          'absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-base shadow-sm transition-transform duration-200 hover:scale-110',
          isFavorite && 'text-red-500',
        )}
      >
        {isFavorite ? '♥' : '♡'}
      </button>

      <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-end justify-between opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <span className="truncate rounded-full bg-black/60 px-2 py-1 text-xs text-white">{eventTitle}</span>
      </div>

      <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
        <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-foreground shadow-sm">Q{photo.price}</span>
        {freshness && (
          <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">{freshness}</span>
        )}
      </div>

      <button
        onClick={() =>
          inCart
            ? remove(photo.id)
            : add({ photoId: photo.id, eventId: photo.event_id, eventTitle, photographerId: photo.photographer_id, photographerName, price: photo.price, storagePath: photo.storage_path, previewPath: photo.preview_path })
        }
        className={cn(
          'absolute bottom-2 right-2 flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold shadow-sm transition-all duration-200',
          inCart ? 'bg-secondary text-white' : 'bg-white text-foreground hover:bg-primary hover:text-white',
        )}
      >
        {inCart ? '✓ En carrito' : '+ Agregar'}
      </button>
    </div>
  )
}
