import { useEffect, useMemo, useRef, useState } from 'react'
import type { Photo } from '../../../data/mockPhotos'
import { getEventById, getPhotographerById } from '../../../data/mockPhotos'
import { PhotoCard } from './PhotoCard'
import { Skeleton } from '../../../ui/flat/Skeleton'

const BATCH_SIZE = 24

interface PhotoGridProps {
  photos: Photo[]
  onOpenPhoto: (photos: Photo[], index: number) => void
}

export function PhotoGrid({ photos, onOpenPhoto }: PhotoGridProps) {
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
          // Simula latencia de red — en la Fase 2 esto es un fetch paginado real.
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
        <span className="text-4xl">🔍</span>
        <p className="text-lg font-semibold">No encontramos fotos con esos filtros</p>
        <p className="text-muted-foreground">Prueba quitando algún filtro o buscando otro evento.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {visible.map((photo) => {
          const event = getEventById(photo.eventId)
          const photographer = getPhotographerById(photo.photographerId)
          return (
            <PhotoCard
              key={photo.id}
              photo={photo}
              eventTitle={event?.title ?? ''}
              photographerName={photographer?.name ?? ''}
              onOpen={() => onOpenPhoto(visible, visible.indexOf(photo))}
            />
          )
        })}
        {loadingMore &&
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={`sk-${i}`} className="aspect-[4/5] w-full" />)}
      </div>
      {visibleCount < photos.length && <div ref={sentinelRef} className="h-1" />}
      {visibleCount >= photos.length && photos.length > BATCH_SIZE && (
        <p className="mt-8 text-center text-sm text-muted-foreground">Viste las {photos.length} fotos disponibles.</p>
      )}
    </div>
  )
}
