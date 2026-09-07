import { useMemo, useState } from 'react'
import { previewUrl } from '../../../lib/r2'
import { supabase } from '../../../lib/supabase'
import { queryClient } from '../../../lib/queryClient'
import { useEventPhotosDetailed, type EventPhoto } from '../useMyEvents'
import { computeSegments } from '../photoSegments'
import { PhotoUploadQueue } from './PhotoUploadQueue'
import { Button } from '../../../ui/studio/Button'
import { useToastStore } from '../../../ui/overlays/toastStore'
import { confirmDialog } from '../../../ui/overlays/confirmStore'
import { IconTrash } from '../../../ui/shared/icons'
import { Dropdown } from '../../../ui/shared/Dropdown'
import AccordionGallery from '../../../ui/reactbits/AccordionGallery'
import { cn } from '../../../lib/cn'

const SEGMENT_PAGE_SIZE = 8

interface EventPointInfo {
  id: string
  label: string
  time_start: string
  time_end: string
}

interface EventImagesManagerProps {
  eventId: string
  photographerId: string
  price: number
  watermarkPath: string | null
  points: EventPointInfo[]
}

function GalleryGrid({
  photos,
  selectedIds,
  onToggleSelect,
}: {
  photos: EventPhoto[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
}) {
  const [visibleCount, setVisibleCount] = useState(SEGMENT_PAGE_SIZE)
  const visible = photos.slice(0, visibleCount)

  return (
    <div>
      <AccordionGallery
        items={visible.map((photo) => ({
          image: previewUrl(photo),
          overlay: (
            <>
              {photo.delivered_path && (
                <span className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  Vendida
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleSelect(photo.id)
                }}
                aria-label="Seleccionar foto"
                className={cn(
                  'absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold opacity-100 transition-colors sm:opacity-0 sm:group-hover:opacity-100',
                  selectedIds.has(photo.id) ? 'border-white bg-white text-black' : 'border-white/80 bg-black/30 text-transparent hover:bg-black/50',
                )}
              >
                ✓
              </button>
            </>
          ),
        }))}
        onPanelClick={(i) => onToggleSelect(visible[i].id)}
        height={220}
        radius={16}
        expandRatio={0.3}
        tilt={6}
        parallax={0.3}
        accentColor="rgb(255 61 0)"
        overlayColor="#000000"
        showLabels={false}
        defaultIndex={0}
      />
      {visibleCount < photos.length && (
        <button
          onClick={() => setVisibleCount((c) => c + SEGMENT_PAGE_SIZE)}
          className="mt-3 w-full rounded-2xl border border-border py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          Ver más fotos ({photos.length - visibleCount} más)
        </button>
      )}
    </div>
  )
}

function PointImagesCard({
  point,
  photos,
  eventId,
  photographerId,
  price,
  watermarkPath,
  selectedIds,
  onToggleSelect,
  onUploaded,
}: {
  point: EventPointInfo
  photos: EventPhoto[]
  eventId: string
  photographerId: string
  price: number
  watermarkPath: string | null
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onUploaded: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [openSegments, setOpenSegments] = useState<Set<string>>(new Set())
  const segments = useMemo(() => computeSegments(photos), [photos])

  function toggleSegment(key: string) {
    setOpenSegments((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card">
      <button onClick={() => setExpanded((e) => !e)} className="flex w-full flex-wrap items-center gap-3 p-4 text-left">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{point.label}</p>
          <p className="text-xs text-muted-foreground">
            {point.time_start.slice(0, 5)} – {point.time_end.slice(0, 5)} · {photos.length} fotos
          </p>
        </div>
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs transition-transform', expanded && 'rotate-180')}>
          ↓
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border p-4">
          <div className="mb-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setUploadOpen((o) => !o)}>
              {uploadOpen ? 'Cerrar' : '+ Subir fotos'}
            </Button>
          </div>
          {uploadOpen && (
            <div className="mb-6">
              <PhotoUploadQueue eventId={eventId} pointId={point.id} photographerId={photographerId} price={price} watermarkPath={watermarkPath} onItemUploaded={onUploaded} />
            </div>
          )}

          {photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay fotos en este punto.</p>
          ) : segments ? (
            <div className="flex flex-col gap-3">
              {segments.map((seg) => (
                <div key={seg.key} className="rounded-2xl border border-border">
                  <button onClick={() => toggleSegment(seg.key)} className="flex w-full items-center justify-between gap-3 p-3 text-left">
                    <p className="text-sm font-semibold">{seg.label} <span className="font-normal text-muted-foreground">· {seg.photos.length} fotos</span></p>
                    <span className={cn('text-xs transition-transform', openSegments.has(seg.key) && 'rotate-180')}>▾</span>
                  </button>
                  {openSegments.has(seg.key) && (
                    <div className="border-t border-border p-3">
                      <GalleryGrid photos={seg.photos} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <GalleryGrid photos={photos} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />
          )}
        </div>
      )}
    </div>
  )
}

/** Subir y organizar fotos por punto desde el propio creador/editor del
 * evento — antes solo era posible desde el visor, obligando a un segundo
 * viaje después de publicar. Misma lógica que StudioEventView (secciones
 * colapsables, grid/lista, selección múltiple + mover/eliminar), adaptada:
 * puntos en grilla de 2 por fila, y cada segmento de tiempo detectado por
 * EXIF es su propio mini-acordeón de máximo 8 fotos. */
export function EventImagesManager({ eventId, photographerId, price, watermarkPath, points }: EventImagesManagerProps) {
  const { data: photos = [] } = useEventPhotosDetailed(eventId)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const push = useToastStore((s) => s.push)

  const photosByPoint = useMemo(() => {
    const map = new Map<string, EventPhoto[]>()
    for (const p of photos) {
      if (p.featured || !p.point_id) continue
      const list = map.get(p.point_id) ?? []
      list.push(p)
      map.set(p.point_id, list)
    }
    return map
  }, [photos])

  function toggleSelect(photoId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(photoId)) next.delete(photoId)
      else next.add(photoId)
      return next
    })
  }

  function invalidatePhotos() {
    queryClient.invalidateQueries({ queryKey: ['event-photos-detailed', eventId] })
    queryClient.invalidateQueries({ queryKey: ['my-events', photographerId] })
  }

  async function bulkMoveTo(pointId: string) {
    if (!pointId) return
    const ids = Array.from(selectedIds)
    const { error } = await supabase.from('photos').update({ point_id: pointId }).in('id', ids)
    if (error) {
      push({ type: 'error', title: 'No se pudo mover', description: error.message })
      return
    }
    push({ type: 'success', title: `${ids.length} foto${ids.length > 1 ? 's' : ''} movida${ids.length > 1 ? 's' : ''}` })
    setSelectedIds(new Set())
    invalidatePhotos()
  }

  async function bulkDelete() {
    const ids = Array.from(selectedIds)
    const ok = await confirmDialog.ask({
      title: `¿Eliminar ${ids.length} foto${ids.length > 1 ? 's' : ''}?`,
      description: 'Las que ya se vendieron no se pueden borrar y se conservan intactas.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!ok) return
    const { error } = await supabase.from('photos').delete().in('id', ids)
    if (error) {
      push({ type: 'error', title: 'No se pudieron eliminar todas', description: error.message })
    } else {
      push({ type: 'success', title: 'Fotos eliminadas' })
    }
    setSelectedIds(new Set())
    invalidatePhotos()
  }

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">Agrega puntos en la pestaña "Ruta"/"Punto" para poder subir fotos.</p>
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {points.map((pt) => (
          <PointImagesCard
            key={pt.id}
            point={pt}
            photos={photosByPoint.get(pt.id) ?? []}
            eventId={eventId}
            photographerId={photographerId}
            price={price}
            watermarkPath={watermarkPath}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onUploaded={invalidatePhotos}
          />
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 md:bottom-6">
          <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-border bg-background px-5 py-3 shadow-lg">
            <span className="text-sm font-semibold">{selectedIds.size} seleccionada{selectedIds.size > 1 ? 's' : ''}</span>
            <Dropdown label="Mover a…" onSelect={bulkMoveTo} options={points.map((pt) => ({ value: pt.id, label: pt.label }))} />
            <button onClick={bulkDelete} className="flex items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500">
              <IconTrash className="h-3.5 w-3.5" />
              Eliminar
            </button>
            <button onClick={() => setSelectedIds(new Set())} aria-label="Cancelar selección" className="ml-1 text-muted-foreground hover:text-foreground">
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
