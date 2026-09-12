import { useEffect, useMemo, useRef, useState } from 'react'
import type { DbPhoto } from '../../../types/db'
import { PhotoCard } from './PhotoCard'
import { Skeleton, SkeletonGrid } from '../../../ui/shared/Skeleton'
import { useScrollFocusStore } from '../../../ui/shared/scrollFocusStore'
import { cn } from '../../../lib/cn'

// Techo de seguridad por si el usuario nunca vuelve a scrollear (ver más
// abajo) — normalmente la supresión se libera antes, en cuanto el usuario
// retoma el scroll por su cuenta.
const SCROLL_FOCUS_SUPPRESS_MS = 4000

const BATCH_SIZE = 36

export interface GridPhoto extends DbPhoto {
  eventTitle: string
  photographerName: string
  pointLabel?: string
  pointTimeStart?: string
  pointTimeEnd?: string
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
  /** Id de la foto que se acaba de cerrar en el visor — recibe un resalte
   * breve para que el usuario no pierda de vista cuál era, entre tantas
   * fotos parecidas. */
  highlightedId?: string | null
  /** Columnas realmente renderizadas (solo se calcula en móvil, ver
   * Search.tsx) — se reenvía a cada `PhotoCard` para decidir ahí si
   * mostrar frescura/acciones según cuántas caben por fila. */
  columns?: number | null
}

export function PhotoGrid({ photos, onOpenPhoto, layout = 'grid', isLoading = false, tileSize = 150, highlightedId = null, columns = null }: PhotoGridProps) {
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

  // Si la foto resaltada (la que se acaba de cerrar en el visor) todavía no
  // está renderizada (el usuario navegó más allá de las primeras
  // `BATCH_SIZE`), primero hay que revelarla antes de poder desplazarse
  // hasta ella.
  useEffect(() => {
    if (!highlightedId) return
    const idx = photos.findIndex((p) => p.id === highlightedId)
    if (idx >= 0 && idx >= visibleCount) setVisibleCount(Math.min(photos.length, idx + BATCH_SIZE))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedId])

  // Ya con la foto renderizada (o si ya lo estaba), centra la vista en ella
  // — pero solo si no está ya visible en pantalla, para no mover nada si el
  // usuario apenas cerró el visor sin haber navegado a otra foto.
  useEffect(() => {
    if (!highlightedId) return
    const el = document.getElementById(`photo-${highlightedId}`)
    if (!el) return
    const rect = el.getBoundingClientRect()
    const inView = rect.top >= 0 && rect.bottom <= window.innerHeight
    if (!inView) {
      // En móvil, el scroll de este `scrollIntoView` también dispara el
      // auto-ocultado del header/menú inferior (ver `useAutoHideHeader`) —
      // que aparecieran/desaparecieran A MITAD de esta animación competía
      // visualmente con ella, y la foto terminaba perdiendo el centrado.
      // Se suprime ese auto-ocultado mientras dura este scroll puntual, Y
      // se mantiene suprimido después de que termine — el usuario recién
      // cerró el visor y podría querer ajustar filtros de inmediato, así
      // que el header/menú se quedan visibles hasta que el usuario
      // retoma el scroll POR SU CUENTA (no el que dispara este
      // `scrollIntoView` automático). `wheel`/`touchstart` son gestos
      // reales del usuario; el scroll programático nunca los dispara.
      useScrollFocusStore.getState().suppress()
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })

      const opts = { passive: true } as const
      function cleanup() {
        window.removeEventListener('wheel', release)
        window.removeEventListener('touchstart', release)
        clearTimeout(fallback)
      }
      function release() {
        useScrollFocusStore.getState().release()
        cleanup()
      }
      window.addEventListener('wheel', release, opts)
      window.addEventListener('touchstart', release, opts)
      const fallback = setTimeout(release, SCROLL_FOCUS_SUPPRESS_MS)

      return cleanup
    }
  }, [highlightedId, visibleCount])

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
        className={cn(
          // Separación reducida (antes gap-2.5/gap-3) para aprovechar mejor
          // el espacio — con grillas de hasta 6-12+ fotos por fila, un gap
          // más chico se nota bastante en cuántas fotos caben cómodas. Ya
          // NO crece en escritorio (`sm:gap-2` se quitó) — al usuario le
          // gustó cómo se ve la separación chica también ahí.
          layout === 'mosaic' ? 'columns-2 gap-1 sm:columns-3 lg:columns-4' : 'grid gap-1 transition-[grid-template-columns] duration-300 ease-out',
        )}
        style={layout === 'grid' ? { gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))` } : undefined}
      >
        {visible.map((photo, i) => (
          <div
            key={photo.id}
            id={`photo-${photo.id}`}
            className={cn(layout === 'mosaic' && 'break-inside-avoid', i < 24 && 'animate-[fade-in-up_.35s_ease-out_backwards]')}
            style={i < 24 ? { animationDelay: `${(i % 12) * 25}ms` } : undefined}
          >
            <PhotoCard
              photo={photo}
              eventTitle={photo.eventTitle}
              photographerName={photo.photographerName}
              layout={layout}
              tileSize={tileSize}
              columns={columns}
              justClosed={photo.id === highlightedId}
              onOpen={() => onOpenPhoto(visible, visible.indexOf(photo))}
            />
          </div>
        ))}
        {loadingMore &&
          layout !== 'mosaic' &&
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={`sk-${i}`} className="aspect-[3/4] w-full" />)}
      </div>
      {visibleCount < photos.length && <div ref={sentinelRef} className="h-1" />}
      {visibleCount >= photos.length && photos.length > BATCH_SIZE && (
        <p className="mt-8 text-center text-sm text-muted-foreground">Viste las {photos.length} fotos disponibles.</p>
      )}
    </div>
  )
}
