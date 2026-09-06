import { useRef, useState } from 'react'
import { previewUrl } from '../../../lib/r2'
import { Button } from '../../../ui/studio/Button'
import { IconTrash } from '../../../ui/shared/icons'
import { useFeaturedPhotosManager, MAX_FEATURED, type FeaturedPhoto, type FeaturedQueueItem } from '../useFeaturedPhotosManager'
import AccordionGallery from '../../../ui/reactbits/AccordionGallery'
import { cn } from '../../../lib/cn'

/** Mismo tratamiento visual que una tarjeta de punto normal — no hay motivo
 * para que "Destacadas" luzca distinta (antes tenía un tinte acento/rojizo
 * que no pegaba con el resto). En móvil arranca colapsada (igual que un
 * punto cualquiera) y usa la misma cuadrícula simple de 3 columnas que ya
 * se usa para las fotos de punto — el acordeón horizontal no tiene sentido
 * en una pantalla angosta. */
function MobileFeaturedTile({
  image,
  onDelete,
  status,
  progress,
  onRetry,
  errorMessage,
}: {
  image: string
  onDelete?: () => void
  status?: 'subiendo' | 'error'
  progress?: number
  onRetry?: () => void
  errorMessage?: string
}) {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-muted">
      <img src={image} alt="" className="h-full w-full object-cover" />
      {status === 'error' ? (
        <button onClick={onRetry} className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/80 p-2 text-center text-[10px] text-white">
          <span>{errorMessage ?? 'Error al subir'}</span>
          <span className="font-bold uppercase tracking-wide text-accent">Reintentar</span>
        </button>
      ) : status === 'subiendo' ? (
        <div className="absolute inset-x-1.5 bottom-1.5 rounded-full bg-black/60 px-2 py-1">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : (
        onDelete && (
          <button onClick={onDelete} aria-label="Quitar foto destacada" className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white">
            <IconTrash className="h-3.5 w-3.5" />
          </button>
        )
      )}
    </div>
  )
}

export function FeaturedPhotosSection({ eventId, photographerId }: { eventId: string; photographerId: string }) {
  const { existing, queue, usedSlots, remaining, enqueue, retry, removeExisting } = useFeaturedPhotosManager(eventId, photographerId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [expanded, setExpanded] = useState(false)

  const items = [
    ...existing.map((photo: FeaturedPhoto) => ({
      key: photo.id,
      image: previewUrl(photo),
      overlay: (
        <button
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            removeExisting(photo.id)
          }}
          aria-label="Quitar foto destacada"
          className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white opacity-100 transition-colors sm:opacity-0 sm:hover:bg-red-500 sm:group-hover:opacity-100"
        >
          <IconTrash className="h-3.5 w-3.5" />
        </button>
      ),
    })),
    ...queue.map((item: FeaturedQueueItem) => ({
      key: item.id,
      image: item.localPreview,
      overlay:
        item.status === 'error' ? (
          <button
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              retry(item)
            }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/80 p-2 text-center text-[10px] text-white"
          >
            <span>{item.errorMessage ?? 'Error al subir'}</span>
            <span className="font-bold uppercase tracking-wide text-accent">Reintentar</span>
          </button>
        ) : (
          <div className="absolute inset-x-2 bottom-2 rounded-full bg-black/60 px-2 py-1">
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full bg-accent transition-all" style={{ width: `${item.progress}%` }} />
            </div>
          </div>
        ),
    })),
  ]

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card transition-colors hover:border-border-hover">
      <button onClick={() => setExpanded((e) => !e)} className="flex w-full flex-wrap items-center gap-4 p-5 text-left">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-muted text-2xl">★</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-studio text-lg font-bold tracking-tight2">Destacadas</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {usedSlots} / {MAX_FEATURED} · tu portafolio de este evento — no están a la venta
          </p>
        </div>
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        >
          ↓
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border p-5">
          <div className="mb-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={remaining === 0}>
              + Subir destacadas
            </Button>
            <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => enqueue(e.target.files)} />
          </div>

          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              Todavía no subes fotos destacadas para este evento.
            </div>
          ) : (
            <>
              {/* Móvil: cuadrícula simple, igual que las fotos de punto. */}
              <div className="grid grid-cols-3 gap-2 sm:hidden">
                {existing.map((photo: FeaturedPhoto) => (
                  <MobileFeaturedTile key={photo.id} image={previewUrl(photo)} onDelete={() => removeExisting(photo.id)} />
                ))}
                {queue.map((item: FeaturedQueueItem) => (
                  <MobileFeaturedTile
                    key={item.id}
                    image={item.localPreview}
                    status={item.status}
                    progress={item.progress}
                    errorMessage={item.errorMessage}
                    onRetry={() => retry(item)}
                  />
                ))}
              </div>

              <div className="hidden sm:block">
                <AccordionGallery
                  items={items.map(({ image, overlay }) => ({ image, overlay }))}
                  height={380}
                  radius={16}
                  expandRatio={0.32}
                  tilt={6}
                  parallax={0.3}
                  accentColor="rgb(255 61 0)"
                  overlayColor="#000000"
                  showLabels={false}
                  defaultIndex={0}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
