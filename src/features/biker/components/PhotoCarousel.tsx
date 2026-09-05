import { useEffect, useState } from 'react'
import { previewUrl } from '../../../lib/r2'
import { cn } from '../../../lib/cn'

const CYCLE_MS = 2600

interface CarouselPhoto {
  id: string
  storage_path: string | null
  preview_path: string | null
}

/** Carrusel automático de fotos — el estilo "una tras otra, con animación"
 * que Mobbin usa para mostrar screenshots de una app dentro de su propia
 * tarjeta, en vez de una sola imagen estática. Reusado por EventCard (fotos
 * destacadas del evento) y por el spotlight de fotógrafos. */
export function PhotoCarousel({ photos, dots = true, className }: { photos: CarouselPhoto[]; dots?: boolean; className?: string }) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (photos.length < 2) return
    const id = setInterval(() => setActive((i) => (i + 1) % photos.length), CYCLE_MS)
    return () => clearInterval(id)
  }, [photos.length])

  return (
    <>
      {photos.map((photo, i) => (
        <img
          key={photo.id}
          src={previewUrl(photo)}
          alt=""
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-125',
            i === active ? 'opacity-100' : 'opacity-0',
            className,
          )}
        />
      ))}
      {dots && photos.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1">
          {photos.map((_, i) => (
            <span key={i} className={cn('h-1 rounded-full transition-all', i === active ? 'w-4 bg-white' : 'w-1 bg-white/50')} />
          ))}
        </div>
      )}
    </>
  )
}
