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
  /** true por un instante justo después de cerrar el visor sobre esta foto
   * — dispara un resalte breve para que no se pierda entre las demás. */
  justClosed?: boolean
}

const FRESHNESS_MIN_TILE_SIZE = 170
// Por debajo de este tamaño (solo alcanzable en el extremo más denso del
// resizer en móvil) los botones de guardar/agregar ya no caben sin verse
// amontonados — se ocultan de la miniatura y el usuario los usa desde el
// visor (que sí tiene espacio de sobra) en su lugar.
const ACTIONS_MIN_TILE_SIZE = 110

/** Foto limpia por defecto — toda la info (precio, favorito, carrito,
 * fotógrafo) solo aparece al pasar el cursor, como en la referencia. */
export function PhotoCard({ photo, eventTitle, photographerName, onOpen, layout = 'grid', tileSize = 220, justClosed = false }: PhotoCardProps) {
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
  const [unsaveBurstKey, setUnsaveBurstKey] = useState<number | null>(null)

  function handleToggleFavorite() {
    const next = !isFavorite
    toggleFavorite(photo.id)
    // Confirmación visual en ambos sentidos: al GUARDAR, como el corazón de
    // Instagram (crece y se desvanece); al QUITAR, el ícono se "rompe" en
    // dos mitades que se separan — ninguna necesita ningún click para
    // cerrarse sola.
    if (next) setSaveBurstKey((k) => (k ?? 0) + 1)
    else setUnsaveBurstKey((k) => (k ?? 0) + 1)
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
      originalFilename: photo.original_filename,
    })
    // Puramente decorativo (prueba pedida explícitamente) — no afecta el
    // carrito en sí, que ya se actualizó arriba.
    if (imgRef.current) flyToCart(imgRef.current.getBoundingClientRect(), previewUrl(photo))
  }

  return (
    // Radio de borde un poco más chico en móvil (`rounded-lg`, antes
    // `rounded-2xl` en todos lados) — con miniaturas más chicas ese radio
    // se comía proporcionalmente más detalle de la esquina de la foto.
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg bg-muted transition-shadow sm:rounded-2xl',
        layout === 'mosaic' && 'mb-3 break-inside-avoid',
        justClosed && 'animate-photo-just-closed',
      )}
    >
      {/* Borde azul persistente en fotos ya agregadas al carrito — un
          overlay `inset-0` con `ring-inset` (mismo patrón que el borde rojo
          de selección en el portal del fotógrafo) en vez de `ring-offset`,
          que dejaba un hueco de 1-2px entre la foto y el borde. Visible
          incluso sin pasar el cursor encima, para que al reiniciar o repetir
          una búsqueda el usuario sepa de un vistazo cuáles ya eligió. */}
      {/* Grosor subido de 2px a 3px — el de 2px se perdía un poco contra
          fotos de fondo oscuro. Se mantiene azul a propósito (no rojo):
          rojo ya quedó reservado para "quitar/limpiar" en toda esta
          página, y usarlo aquí también se prestaría a confundirlo con una
          advertencia en vez de una confirmación de "ya lo tienes". */}
      {inCart && <span className="pointer-events-none absolute inset-0 z-[2] rounded-lg ring-[3px] ring-inset ring-blue-500 sm:rounded-2xl" />}

      {saveBurstKey !== null && (
        <div key={saveBurstKey} className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center" onAnimationEnd={() => setSaveBurstKey(null)}>
          <IconBookmark filled className="h-16 w-16 animate-save-burst text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" />
        </div>
      )}

      {unsaveBurstKey !== null && (
        <div
          key={unsaveBurstKey}
          className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center"
          onAnimationEnd={() => setUnsaveBurstKey(null)}
        >
          <div className="relative h-16 w-16 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
            <IconBookmark filled className="absolute inset-0 h-16 w-16 animate-unsave-break-left text-white" style={{ clipPath: 'inset(0 50% 0 0)' }} />
            <IconBookmark filled className="absolute inset-0 h-16 w-16 animate-unsave-break-right text-white" style={{ clipPath: 'inset(0 0 0 50%)' }} />
          </div>
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

      {/* Por debajo de `ACTIONS_MIN_TILE_SIZE` (el extremo más denso del
          resizer en móvil) estos botones ya no caben sin verse amontonados
          — el usuario los usa desde el visor en su lugar, que sí tiene
          espacio de sobra. */}
      {tileSize >= ACTIONS_MIN_TILE_SIZE && (
        <>
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
                  // Blanco por defecto, azul relleno una vez agregada — antes
                  // usaba un check verde separado; ahora es el mismo botón, el
                  // color y el ícono (carrito relleno vs. contorno) son la
                  // única diferencia entre "agregar" y "ya en el carrito".
                  'pointer-events-auto flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold shadow-sm transition-all duration-200 sm:h-9 sm:px-3',
                  inCart ? 'bg-primary text-white' : 'bg-white text-foreground hover:bg-primary hover:text-white',
                )}
              >
                <IconCart className="h-3.5 w-3.5" filled={inCart} />
                {/* Precio oculto en móvil — con miniaturas chicas y varias por
                    fila, este botón ya compite por poco espacio; el ícono solo
                    sigue dejando claro qué hace. */}
                {!inCart && <span className="hidden sm:inline">Q{photo.price}</span>}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
