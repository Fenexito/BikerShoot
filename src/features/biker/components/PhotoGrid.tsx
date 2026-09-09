import { useEffect, useMemo, useRef, useState } from 'react'
import type { DbPhoto } from '../../../types/db'
import { PhotoCard } from './PhotoCard'
import { Skeleton, SkeletonGrid } from '../../../ui/shared/Skeleton'
import { cn } from '../../../lib/cn'

const BATCH_SIZE = 36

export interface GridPhoto extends DbPhoto {
  eventTitle: string
  photographerName: string
  pointLabel?: string
}

interface PhotoGridProps {
  photos: GridPhoto[]
  onOpenPhoto: (photos: GridPhoto[], index: number) => void
  layout?: 'grid' | 'mosaic'
  isLoading?: boolean
  /** Ancho mínimo (px) de cada foto en la vista `grid` — controla cuántas
   * columnas caben por fila (`auto-fill` calcula el resto solo). El
   * resizer de Search.tsx cambia este valor; el resto de usos de
   * PhotoGrid (perfil del fotógrafo) se quedan con el tamaño fijo de
   * siempre. Solo aplica a `layout='grid'` — `mosaic` usa columnas fijas
   * por breakpoint (`columns-2 sm:columns-3 lg:columns-4`), no relacionado
   * con este control. */
  tileSize?: number
}

export function PhotoGrid({ photos, onOpenPhoto, layout = 'grid', isLoading = false, tileSize = 150 }: PhotoGridProps) {
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

  if (isLoading) {
    return <SkeletonGrid count={12} className="sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" />
  }

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
        className={cn(layout === 'mosaic' ? 'columns-2 gap-2.5 sm:columns-3 sm:gap-3 lg:columns-4' : 'grid gap-2.5 sm:gap-3')}
        style={layout === 'grid' ? { gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))` } : undefined}
      >
        {visible.map((photo, i) => (
          <div
            key={photo.id}
            className={cn(layout === 'mosaic' && 'break-inside-avoid', i < 24 && 'animate-[fade-in-up_.35s_ease-out_backwards]')}
            style={i < 24 ? { animationDelay: `${(i % 12) * 25}ms` } : undefined}
          >
            <PhotoCard
              photo={photo}
              eventTitle={photo.eventTitle}
              photographerName={photo.photographerName}
              layout={layout}
              onOpen={() => onOpenPhoto(visible, visible.indexOf(photo))}
            />
          </div>
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
