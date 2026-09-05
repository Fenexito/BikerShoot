import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/thumbnails.css'
import './PhotoLightbox.css'
import { Link } from 'react-router-dom'
import { previewUrl } from '../../../lib/r2'
import { useCartStore } from '../../cart/cartStore'
import { useFavoritesStore } from '../favoritesStore'
import { Button } from '../../../ui/flat/Button'
import { IconBookmark } from '../../../ui/shared/icons'
import type { GridPhoto } from './PhotoGrid'

// Cada slide carga su GridPhoto completo — así los slots de render (header,
// footer) tienen todo lo que necesitan (evento, fotógrafo, punto, archivo,
// precio, destacada) sin tener que buscarlo por fuera.
declare module 'yet-another-react-lightbox' {
  interface SlideImage {
    photoData: GridPhoto
  }
}

interface PhotoLightboxProps {
  photos: GridPhoto[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

function SlideHeader({ photo, position }: { photo: GridPhoto; position: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/70 to-transparent px-4 pb-10 pt-4 sm:px-6">
      <div className="pointer-events-auto flex items-start justify-between gap-4 text-white">
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
        <span className="shrink-0 pt-1 text-sm text-white/60">{position}</span>
      </div>
    </div>
  )
}

function SlideFooter({ photo }: { photo: GridPhoto }) {
  const inCart = useCartStore((s) => s.has(photo.id))
  const add = useCartStore((s) => s.add)
  const remove = useCartStore((s) => s.remove)
  const isFavorite = useFavoritesStore((s) => s.has(photo.id))
  const toggleFavorite = useFavoritesStore((s) => s.toggle)

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-black/70 to-transparent px-4 pb-5 pt-10 sm:px-6">
      <div className="pointer-events-auto flex w-full max-w-xl flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-3.5 backdrop-blur-md">
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
  )
}

export function PhotoLightbox({ photos, index, onClose, onNavigate }: PhotoLightboxProps) {
  return (
    <Lightbox
      open
      close={onClose}
      index={index}
      slides={photos.map((p) => ({ src: previewUrl(p), alt: p.eventTitle, photoData: p }))}
      on={{ view: ({ index: i }) => onNavigate(i) }}
      plugins={[Zoom, Thumbnails]}
      zoom={{ scrollToZoom: true, maxZoomPixelRatio: 4, zoomInMultiplier: 1.5 }}
      thumbnails={{ position: 'bottom', width: 56, height: 72, gap: 8, border: 0, padding: 0 }}
      carousel={{ finite: false, padding: 0, imageFit: 'contain' }}
      animation={{ swipe: 250 }}
      render={{
        slideHeader: ({ slide }) => <SlideHeader photo={slide.photoData} position={`${index + 1} / ${photos.length}`} />,
        slideFooter: ({ slide }) => <SlideFooter photo={slide.photoData} />,
      }}
      className="motoshots-lightbox"
    />
  )
}
