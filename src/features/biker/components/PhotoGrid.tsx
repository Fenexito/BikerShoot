import { useEffect, useMemo, useRef, useState } from 'react'
import type { DbPhoto } from '../../../types/db'
import { PhotoCard } from './PhotoCard'
import { Skeleton } from '../../../ui/flat/Skeleton'
import { cn } from '../../../lib/cn'

const BATCH_SIZE = 36

export interface GridPhoto extends DbPhoto {
  eventTitle: string
  photographerName: string
}

interface PhotoGridProps {
  photos: GridPhoto[]
  onOpenPhoto: (photos: GridPhoto[], index: number) => void
  layout?: 'grid' | 'mosaic'
}

export function PhotoGrid({ photos, onOpenPhoto, layout = 'grid' }: PhotoGridProps) {
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVisibleCount(BATCH_SIZE)
  }, [photos])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < photos.length) {
          setLoadingMore(true)
          setTimeout(() => {
            setVisibleCount((c) => Math.min(c + BATCH_SIZE, photos.length))
            setLoadingMore(false)
          }, 300)
        }
      },
      { rootMargin: '600px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visibleCount, photos.length])

  const visible = useMemo(() => photos.slice(0, visibleCount), [photos, visibleCount])

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <span className="text-4xl">🏍️💨</span>
        <p className="text-lg font-semibold">Ninguna foto coincide con esos filtros</p>
        <p className="text-muted-foreground">Prueba con otro punto de la ruta, otra fecha, o quita algún filtro.</p>
      </div>
    )
  }

  return (
    <div>
      <div
        className={cn(
          layout === 'mosaic'
            ? 'columns-2 gap-2.5 sm:columns-3 sm:gap-3 lg:columns-4'
            : 'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 sm:gap-3',
        )}
      >
        {visible.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            eventTitle={photo.eventTitle}
            photographerName={photo.photographerName}
            layout={layout}
            onOpen={() => onOpenPhoto(visible, visible.indexOf(photo))}
          />
        ))}
        {loadingMore &&
          layout !== 'mosaic' &&
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={`sk-${i}`} className="aspect-[4/5] w-full" />)}
      </div>
      {visibleCount < photos.length && <div ref={sentinelRef} className="h-1" />}
      {visibleCount >= photos.length && photos.length > BATCH_SIZE && (
        <p className="mt-8 text-center text-sm text-muted-foreground">Viste las {photos.length} fotos disponibles.</p>
      )}
    </div>
  )
}
