import { useRef, useState } from 'react'
import type { DbPhoto } from '../../../types/db'
import { previewUrl } from '../../../lib/r2'
import { useCartStore } from '../../cart/cartStore'
import { useFavoritesStore } from '../favoritesStore'
import { timeAgo } from '../../../lib/timeAgo'
import { flyToCart } from '../../../lib/flyToCart'
import { IconBookmark, IconCart } from '../../../ui/shared/icons'
import { cn } from '../../../lib/cn'

interface PhotoCardProps {
  photo: DbPhoto
  eventTitle: string
  photographerName: string
  onOpen: () => void
  layout?: 'grid' | 'mosaic'
  /** Tamaño actual de la miniatura (px) — con marcos chicos (grilla densa)
   * la etiqueta de frescura ("hace 2h") ocupa demasiado espacio relativo a
   * la foto, así que se oculta por debajo de cierto tamaño. */
  tileSize?: number
}

const FRESHNESS_MIN_TILE_SIZE = 170

/** Foto limpia por defecto — toda la info (precio, favorito, carrito,
 * fotógrafo) solo aparece al pasar el cursor, como en la referencia. */
export function PhotoCard({ photo, eventTitle, photographerName, onOpen, layout = 'grid', tileSize = 220 }: PhotoCardProps) {
  const inCart = useCartStore((s) => s.has(photo.id))
  const add = useCartStore((s) => s.add)
  const remove = useCartStore((s) => s.remove)
  const isFavorite = useFavoritesStore((s) => s.has(photo.id))
  const toggleFavorite = useFavoritesStore((s) => s.toggle)
  const freshness = timeAgo(photo.created_at)
  const imgRef = useRef<HTMLImageElement>(null)
  // `null` = sin animación en curso; un número = "monta el overlay de nuevo
  // con esta key" (fuerza a React a re-crear el nodo y así reiniciar la
  // animación CSS aunque el usuario guarde/quite/guarde varias veces
  // seguidas antes de que termine la anterior).
  const [saveBurstKey, setSaveBurstKey] = useState<number | null>(null)

  function handleToggleFavorite() {
    const next = !isFavorite
    toggleFavorite(photo.id)
    // Confirmación visual solo al GUARDAR (no al quitar) — como el corazón
    // de Instagram, se muestra sola y se desvanece, sin necesitar ningún
    // click para cerrarla.
    if (next) setSaveBurstKey((k) => (k ?? 0) + 1)
  }

  function handleAddClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (inCart) {
      remove(photo.id)
      return
    }
    add({
      photoId: photo.id,
      eventId: photo.event_id,
      eventTitle,
      photographerId: photo.photographer_id,
      photographerName,
      price: photo.price,
      storagePath: photo.storage_path,
      previewPath: photo.preview_path,
    })
    // Puramente decorativo (prueba pedida explícitamente) — no afecta el
    // carrito en sí, que ya se actualizó arriba.
    if (imgRef.current) flyToCart(imgRef.current.getBoundingClientRect(), previewUrl(photo))
  }

  return (
    <div className={cn('group relative overflow-hidden rounded-2xl bg-muted transition-shadow', layout === 'mosaic' && 'mb-3 break-inside-avoid')}>
      {/* Borde azul persistente en fotos ya agregadas al carrito — un
          overlay `inset-0` con `ring-inset` (mismo patrón que el borde rojo
          de selección en el portal del fotógrafo) en vez de `ring-offset`,
          que dejaba un hueco de 1-2px entre la foto y el borde. Visible
          incluso sin pasar el cursor encima, para que al reiniciar o repetir
          una búsqueda el usuario sepa de un vistazo cuáles ya eligió. */}
      {inCart && <span className="pointer-events-none absolute inset-0 z-[2] rounded-2xl ring-2 ring-inset ring-blue-500" />}

      {saveBurstKey !== null && (
        <div key={saveBurstKey} className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center" onAnimationEnd={() => setSaveBurstKey(null)}>
          <IconBookmark filled className="h-16 w-16 animate-save-burst text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" />
        </div>
      )}

      <button onClick={onOpen} className="block w-full">
        <img
          ref={imgRef}
          src={previewUrl(photo)}
          alt={`Foto de ${eventTitle}`}
          loading="lazy"
          className={cn(
            // `scale-110` (antes 105): zoom de hover un poco más notorio.
            'w-full object-cover transition-transform duration-500 group-hover:scale-110',
            // `aspect-[3/4]` (antes 4/5): marco un poco más alto — con muchos
            // fotógrafos subiendo fotos verticales, el marco anterior recortaba
            // algo de la parte superior/inferior en esas fotos. No sabemos aún
            // las dimensiones reales de cada foto (no se guardan en `photos`),
            // así que este es un ajuste global de prueba, no una detección de
            // orientación por foto — si el recorte lateral en fotos horizontales
            // se siente peor que antes, es la contraparte de este cambio.
            layout === 'mosaic' ? 'h-auto' : 'aspect-[3/4]',
          )}
        />
      </button>

      {/* Degradados — solo visibles en hover, como la foto limpia de referencia */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100" />

      {/* Barra superior: frescura + favorito — la frescura se oculta en
          marcos chicos (grilla densa), donde ocupa demasiado espacio. */}
      <div className="absolute inset-x-2 top-2 flex items-start justify-between opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100">
        {freshness && tileSize >= FRESHNESS_MIN_TILE_SIZE ? (
          <span className="rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-semibold text-white shadow-sm">{freshness}</span>
        ) : (
          <span />
        )}
        <button
          onClick={handleToggleFavorite}
          aria-label="Guardar"
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full bg-white/95 shadow-sm transition-transform duration-200 hover:scale-110',
            isFavorite ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          <IconBookmark className="h-3.5 w-3.5" filled={isFavorite} />
        </button>
      </div>

      {/* Barra inferior: solo agregar al carrito — sin recuadro de fotógrafo/evento
          (esa info ya vive en el visor). Las destacadas no están a la venta. */}
      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-end justify-end gap-2 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100">
        {photo.featured ? (
          <span className="pointer-events-auto flex h-8 shrink-0 items-center gap-1 rounded-full bg-amber-400 px-3 text-xs font-semibold text-black shadow-sm">
            ★ Destacada
          </span>
        ) : (
          <button
            onClick={handleAddClick}
            aria-label={inCart ? 'Quitar del carrito' : 'Agregar al carrito'}
            className={cn(
              'pointer-events-auto flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold shadow-sm transition-all duration-200',
              inCart ? 'bg-secondary text-white' : 'bg-white text-foreground hover:bg-primary hover:text-white',
            )}
          >
            {inCart ? (
              <>✓ En carrito</>
            ) : (
              <>
                <IconCart className="h-3.5 w-3.5" />
                Q{photo.price}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
