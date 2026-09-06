import { useRef, useState } from 'react'
import { previewUrl } from '../../../lib/r2'
import { Button } from '../../../ui/studio/Button'
import { IconTrash } from '../../../ui/shared/icons'
import { useFeaturedPhotosManager, MAX_FEATURED } from '../useFeaturedPhotosManager'
import AccordionGallery from '../../../ui/reactbits/AccordionGallery'
import { cn } from '../../../lib/cn'

/** Sección "★ Destacadas" del visor del evento — separada de los puntos y
 * de "sin punto asignado" (antes las fotos destacadas caían ahí por error).
 * Permite subir directamente desde aquí, no solo desde el editor. Tiles más
 * altos que las filas normales de punto — la mayoría de destacadas son
 * verticales y lucen mejor así. Expandida por defecto, pero colapsable. */
export function FeaturedPhotosSection({ eventId, photographerId }: { eventId: string; photographerId: string }) {
  const { existing, queue, usedSlots, remaining, enqueue, retry, removeExisting } = useFeaturedPhotosManager(eventId, photographerId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [expanded, setExpanded] = useState(true)

  const items = [
    ...existing.map((photo) => ({
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
    ...queue.map((item) => ({
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
    <div className="overflow-hidden rounded-3xl border border-accent/30 bg-accent/5">
      <button onClick={() => setExpanded((e) => !e)} className="flex w-full flex-wrap items-center gap-4 p-5 text-left">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-2xl">★</span>
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
        <div className="border-t border-accent/20 p-5">
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
          )}
        </div>
      )}
    </div>
  )
}
