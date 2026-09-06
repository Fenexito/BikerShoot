import { useRef } from 'react'
import { previewUrl } from '../../../lib/r2'
import { Button } from '../../../ui/studio/Button'
import { IconTrash } from '../../../ui/shared/icons'
import { useFeaturedPhotosManager, MAX_FEATURED } from '../useFeaturedPhotosManager'
import { cn } from '../../../lib/cn'

export { MAX_FEATURED }

/** Fotos destacadas — el portafolio del fotógrafo, no fotos del punto de un
 * evento. Se suben aquí, en el editor (junto a portada/marca de agua), en
 * calidad alta y sin marca de agua: nunca están a la venta. Estas mismas
 * fotos alimentan la página del evento, el perfil público y el muro de
 * login — ver [[motoshots_v2_domain_mechanics]]. */
export function FeaturedPhotosUploader({ eventId, photographerId }: { eventId: string; photographerId: string }) {
  const { existing, queue, usedSlots, remaining, enqueue, retry, removeExisting } = useFeaturedPhotosManager(eventId, photographerId)
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{usedSlots} / {MAX_FEATURED} fotos destacadas</p>
        <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={remaining === 0}>
          + Subir fotos destacadas
        </Button>
        <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => enqueue(e.target.files)} />
      </div>

      {existing.length === 0 && queue.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          Todavía no subes fotos destacadas para este evento.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {existing.map((photo) => (
            <div key={photo.id} className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-border">
              <img src={previewUrl(photo)} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => removeExisting(photo.id)}
                aria-label="Quitar foto destacada"
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <IconTrash className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {queue.map((item) => (
            <div key={item.id} className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-border">
              <img src={item.localPreview} alt="" className={cn('h-full w-full object-cover', item.status === 'error' && 'opacity-40')} />
              {item.status === 'subiendo' && (
                <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-1">
                  <div className="h-1 w-full bg-white/20">
                    <div className="h-full bg-accent transition-all" style={{ width: `${item.progress}%` }} />
                  </div>
                </div>
              )}
              {item.status === 'error' && (
                <button
                  onClick={() => retry(item)}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/80 p-2 text-center text-[10px] text-white"
                >
                  <span>{item.errorMessage ?? 'Error al subir'}</span>
                  <span className="font-bold uppercase tracking-wide text-accent">Reintentar</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
