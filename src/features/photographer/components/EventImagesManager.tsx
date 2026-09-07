import { useMemo, useState } from 'react'
import { previewUrl } from '../../../lib/r2'
import { supabase } from '../../../lib/supabase'
import { queryClient } from '../../../lib/queryClient'
import { useEventPhotosDetailed, type EventPhoto } from '../useMyEvents'
import { computeSegments } from '../photoSegments'
import { PhotoUploadQueue } from './PhotoUploadQueue'
import { Button } from '../../../ui/studio/Button'
import { TimePicker } from '../../../ui/shared/TimePicker'
import { useToastStore } from '../../../ui/overlays/toastStore'
import { confirmDialog } from '../../../ui/overlays/confirmStore'
import { IconTrash } from '../../../ui/shared/icons'
import { Dropdown } from '../../../ui/shared/Dropdown'
import AccordionGallery from '../../../ui/reactbits/AccordionGallery'
import { cn } from '../../../lib/cn'

const ROW_SIZE = 8

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

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
  eventDate: string
  points: EventPointInfo[]
}

/** Cuadrícula móvil de solo-vista — subir/organizar fotos de un punto es
 * exclusivo de escritorio (el mapa y el acordeón horizontal no funcionan
 * bien en una pantalla angosta); en móvil el fotógrafo solo puede revisar
 * lo que ya subió, igual que en el visor del evento. */
function MobileReadOnlyGrid({ photos }: { photos: EventPhoto[] }) {
  if (photos.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay fotos en este punto.</p>
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo) => (
        <div key={photo.id} className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-muted">
          <img src={previewUrl(photo)} alt="" className="h-full w-full object-cover" />
          {photo.delivered_path && (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
              Vendida
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/** Filas adicionales de acordeón (8 fotos cada una) — "ver más" agrega otra
 * fila abajo, igual que la paginación del visor del evento, en vez de
 * inflar la misma fila con más elementos. */
function GalleryRows({
  photos,
  selectedIds,
  onToggleSelect,
}: {
  photos: EventPhoto[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
}) {
  const [visibleRows, setVisibleRows] = useState(1)
  const rows = useMemo(() => chunk(photos, ROW_SIZE), [photos])
  const shown = rows.slice(0, visibleRows)
  const remaining = photos.length - shown.reduce((s, r) => s + r.length, 0)

  return (
    <div className="flex flex-col gap-3">
      {shown.map((rowPhotos, i) => (
        <AccordionGallery
          key={i}
          items={rowPhotos.map((photo) => ({
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
          onPanelClick={(idx) => onToggleSelect(rowPhotos[idx].id)}
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
      ))}
      {remaining > 0 && (
        <button
          onClick={() => setVisibleRows((c) => c + 1)}
          className="w-full rounded-2xl border border-border py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          Ver más fotos ({remaining} más)
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
  expanded,
  onToggleExpanded,
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
  expanded: boolean
  onToggleExpanded: () => void
}) {
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
      <button onClick={onToggleExpanded} className="flex w-full flex-wrap items-center gap-3 p-4 text-left">
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
          {/* Móvil: solo revisar lo ya subido — subir y organizar es de escritorio. */}
          <div className="sm:hidden">
            <p className="mb-3 text-xs text-muted-foreground">Sube fotos a este punto desde la versión web en una computadora.</p>
            <MobileReadOnlyGrid photos={photos} />
          </div>

          <div className="hidden sm:block">
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
                        <GalleryRows photos={seg.photos} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <GalleryRows photos={photos} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Subir y organizar fotos por punto desde el propio creador/editor del
 * evento — antes solo era posible desde el visor, obligando a un segundo
 * viaje después de publicar. Puntos en grilla de 2 por fila (escritorio);
 * si se expande uno, su pareja de fila se expande también (por simetría
 * visual) — expandir/colapsar de un par siempre va junto. */
export function EventImagesManager({ eventId, photographerId, price, watermarkPath, eventDate, points }: EventImagesManagerProps) {
  const { data: photos = [] } = useEventPhotosDetailed(eventId)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [openRows, setOpenRows] = useState<Set<number>>(new Set())
  const [assignHourOpen, setAssignHourOpen] = useState(false)
  const [assignHourValue, setAssignHourValue] = useState('06:00')
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

  function toggleRow(rowIndex: number) {
    setOpenRows((prev) => {
      const next = new Set(prev)
      if (next.has(rowIndex)) next.delete(rowIndex)
      else next.add(rowIndex)
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

  // Reasignación manual de horario — para fotos sin EXIF (capturas de
  // pantalla, reenvíos de WhatsApp, exportaciones que perdieron los
  // metadatos). Escribe un `captured_at` sintético a partir de la fecha del
  // evento + la hora elegida, así el mismo algoritmo de segmentos las
  // clasifica solas de ahí en adelante — no hace falta una UI aparte.
  async function assignHour() {
    const ids = Array.from(selectedIds)
    const capturedAt = new Date(`${eventDate}T${assignHourValue}:00`).toISOString()
    const { error } = await supabase.from('photos').update({ captured_at: capturedAt }).in('id', ids)
    if (error) {
      push({ type: 'error', title: 'No se pudo asignar la hora', description: error.message })
      return
    }
    push({ type: 'success', title: `Hora asignada a ${ids.length} foto${ids.length > 1 ? 's' : ''}` })
    setAssignHourOpen(false)
    setSelectedIds(new Set())
    invalidatePhotos()
  }

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">Agrega puntos en la pestaña "Ruta"/"Punto" para poder subir fotos.</p>
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {points.map((pt, i) => {
          const rowIndex = Math.floor(i / 2)
          return (
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
              expanded={openRows.has(rowIndex)}
              onToggleExpanded={() => toggleRow(rowIndex)}
            />
          )
        })}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 md:bottom-6">
          <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-border bg-background px-5 py-3 shadow-lg">
            <span className="text-sm font-semibold">{selectedIds.size} seleccionada{selectedIds.size > 1 ? 's' : ''}</span>
            <Dropdown label="Mover a…" onSelect={bulkMoveTo} options={points.map((pt) => ({ value: pt.id, label: pt.label }))} />
            <button onClick={() => setAssignHourOpen(true)} className="rounded-full border border-border bg-background px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-muted">
              Asignar hora
            </button>
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

      {assignHourOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60" onClick={() => setAssignHourOpen(false)} />
          <div className="relative z-10 w-full max-w-xs rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="text-base font-bold">Asignar hora manualmente</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Para fotos sin hora de captura registrada (sin EXIF) — se agrupan solas en el segmento correspondiente.
            </p>
            <div className="mt-4">
              <TimePicker label="Hora aproximada" value={assignHourValue} onChange={setAssignHourValue} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setAssignHourOpen(false)}>Cancelar</Button>
              <Button variant="dark" size="sm" onClick={assignHour}>Asignar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
