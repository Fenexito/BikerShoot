import type { DbPhoto } from '../../../types/db'
import { previewUrl } from '../../../lib/r2'
import { useCartStore } from '../../cart/cartStore'
import { useFavoritesStore } from '../favoritesStore'
import { timeAgo } from '../../../lib/timeAgo'
import { InitialsAvatar } from '../../../ui/shared/InitialsAvatar'
import { IconBookmark } from '../../../ui/shared/icons'
import { cn } from '../../../lib/cn'

interface PhotoCardProps {
  photo: DbPhoto
  eventTitle: string
  photographerName: string
  onOpen: () => void
  layout?: 'grid' | 'mosaic'
}

/** Foto limpia por defecto — toda la info (precio, favorito, carrito,
 * fotógrafo) solo aparece al pasar el cursor, como en la referencia. */
export function PhotoCard({ photo, eventTitle, photographerName, onOpen, layout = 'grid' }: PhotoCardProps) {
  const inCart = useCartStore((s) => s.has(photo.id))
  const add = useCartStore((s) => s.add)
  const remove = useCartStore((s) => s.remove)
  const isFavorite = useFavoritesStore((s) => s.has(photo.id))
  const toggleFavorite = useFavoritesStore((s) => s.toggle)
  const freshness = timeAgo(photo.created_at)

  return (
    <div className={cn('group relative overflow-hidden rounded-2xl bg-muted', layout === 'mosaic' && 'mb-3 break-inside-avoid')}>
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

      {/* Degradados — solo visibles en hover, como la foto limpia de referencia */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100" />

      {/* Barra superior: frescura + favorito */}
      <div className="absolute inset-x-2 top-2 flex items-start justify-between opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100">
        {freshness ? (
          <span className="rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-semibold text-white shadow-sm">{freshness}</span>
        ) : (
          <span />
        )}
        <button
          onClick={() => toggleFavorite(photo.id)}
          aria-label="Guardar"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-sm transition-transform duration-200 hover:scale-110',
            isFavorite ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          <IconBookmark className="h-4 w-4" filled={isFavorite} />
        </button>
      </div>

      {/* Barra inferior: fotógrafo + agregar al carrito */}
      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-end justify-between gap-2 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100">
        <div className="flex min-w-0 items-center gap-2 text-white">
          <InitialsAvatar name={photographerName} className="h-7 w-7 shrink-0 border-2 border-white/80 bg-primary text-[10px] text-white" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight">{photographerName}</p>
            <p className="truncate text-[10px] leading-tight text-white/70">{eventTitle}</p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            inCart
              ? remove(photo.id)
              : add({ photoId: photo.id, eventId: photo.event_id, eventTitle, photographerId: photo.photographer_id, photographerName, price: photo.price, storagePath: photo.storage_path, previewPath: photo.preview_path })
          }}
          className={cn(
            'pointer-events-auto flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold shadow-sm transition-all duration-200',
            inCart ? 'bg-secondary text-white' : 'bg-white text-foreground hover:bg-primary hover:text-white',
          )}
        >
          {inCart ? '✓ En carrito' : `Q${photo.price} · Agregar`}
        </button>
      </div>
    </div>
  )
}
