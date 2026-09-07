import { useMemo, useState } from 'react'
import { previewUrl } from '../../../lib/r2'
import { supabase } from '../../../lib/supabase'
import { queryClient } from '../../../lib/queryClient'
import { useEventPhotosDetailed, type EventPhoto } from '../useMyEvents'
import { computeSegments } from '../photoSegments'
import { sortPhotosByFilename } from '../sortPhotos'
import { groupByDeclaredSegments } from '../photoGrouping'
import { PhotoUploadQueue } from './PhotoUploadQueue'
import { Button } from '../../../ui/studio/Button'
import { useToastStore } from '../../../ui/overlays/toastStore'
import { confirmDialog } from '../../../ui/overlays/confirmStore'
import { IconTrash } from '../../../ui/shared/icons'
import { Dropdown } from '../../../ui/shared/Dropdown'
import { ActionMenu } from '../../../ui/shared/ActionMenu'
import AccordionGallery from '../../../ui/reactbits/AccordionGallery'
import { cn } from '../../../lib/cn'

const ROW_SIZE = 8
const MOBILE_PAGE_SIZE = 12

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

interface ManualSegment {
  start: string
  end: string
}

interface EventPointInfo {
  id: string
  label: string
  time_start: string
  time_end: string
  manual_segments: ManualSegment[]
}

interface SegmentLike {
  key: string
  label: string
  photos: EventPhoto[]
  forcedCapturedAt?: string
  dashed?: boolean
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
 * lo que ya subió, igual que en el visor del evento (máximo 12 a la vez,
 * con "ver más"). Cada punto se expande de forma independiente (sin
 * parejas de fila — en una sola columna no aplica el emparejado). */
function MobilePointRow({ point, photos }: { point: EventPointInfo; photos: EventPhoto[] }) {
  const [expanded, setExpanded] = useState(false)
  const [visibleCount, setVisibleCount] = useState(MOBILE_PAGE_SIZE)
  const visible = photos.slice(0, visibleCount)

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
          <p className="mb-3 text-xs text-muted-foreground">Sube fotos a este punto desde la versión web en una computadora.</p>
          {photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay fotos en este punto.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {visible.map((photo) => (
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
              {visibleCount < photos.length && (
                <button
                  onClick={() => setVisibleCount((c) => c + MOBILE_PAGE_SIZE)}
                  className="mt-3 w-full rounded-2xl border border-border py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                >
                  Ver más fotos ({photos.length - visibleCount} más)
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Filas adicionales de acordeón (8 fotos cada una) — "ver más" agrega otra
 * fila abajo. Por defecto cada instancia maneja su propia paginación; si el
 * padre pasa `visibleRows`/`onShowMore` (dos horarios "gemelos" en la misma
 * fila), la paginación queda controlada desde afuera y ambos avanzan juntos
 * al presionar "ver más" en cualquiera de los dos. */
function GalleryRows({
  photos,
  selectedIds,
  onToggleSelect,
  visibleRows: visibleRowsProp,
  onShowMore: onShowMoreProp,
}: {
  photos: EventPhoto[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  visibleRows?: number
  onShowMore?: () => void
}) {
  const [visibleRowsState, setVisibleRowsState] = useState(1)
  const visibleRows = visibleRowsProp ?? visibleRowsState
  const onShowMore = onShowMoreProp ?? (() => setVisibleRowsState((r) => r + 1))
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
                {/* Anillo delgado — solo una confirmación visual, no un marco pesado. */}
                {selectedIds.has(photo.id) && <span className="absolute inset-0 z-[2] rounded-2xl ring-2 ring-inset ring-red-500" />}
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
                    selectedIds.has(photo.id) ? 'border-red-500 bg-red-500 text-white' : 'border-white/80 bg-black/30 text-transparent hover:bg-black/50',
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
          onClick={onShowMore}
          className="w-full rounded-2xl border border-border py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          Ver más fotos ({remaining} más)
        </button>
      )}
    </div>
  )
}

/** Menú "···" con la opción de seleccionar/deseleccionar todo el grupo —
 * no es algo que se use seguido, así que vive detrás de un botón discreto
 * en vez de competir visualmente con "Cargar fotos"/"Subir fotos". */
function SelectMenu({ ids, selectedIds, onSelectMany, onDeselectMany, triggerClassName }: {
  ids: string[]
  selectedIds: Set<string>
  onSelectMany: (ids: string[]) => void
  onDeselectMany: (ids: string[]) => void
  triggerClassName?: string
}) {
  if (ids.length === 0) return null
  const allSelected = ids.every((id) => selectedIds.has(id))
  return (
    <ActionMenu
      triggerClassName={triggerClassName}
      items={[{ label: allSelected ? 'Deseleccionar' : 'Seleccionar todas', onClick: () => (allSelected ? onDeselectMany(ids) : onSelectMany(ids)) }]}
    />
  )
}

function DesktopPointCard({
  point,
  photos,
  eventId,
  photographerId,
  price,
  watermarkPath,
  eventDate,
  selectedIds,
  onToggleSelect,
  onSelectMany,
  onDeselectMany,
  onUploaded,
}: {
  point: EventPointInfo
  photos: EventPhoto[]
  eventId: string
  photographerId: string
  price: number
  watermarkPath: string | null
  eventDate: string
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectMany: (ids: string[]) => void
  onDeselectMany: (ids: string[]) => void
  onUploaded: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadPickerOpen, setUploadPickerOpen] = useState(false)
  const [openRows, setOpenRows] = useState<Set<number>>(new Set())
  const [visibleRowsByRow, setVisibleRowsByRow] = useState<Record<number, number>>({})
  const [segmentUploadOpen, setSegmentUploadOpen] = useState<string | null>(null)
  const autoSegments = useMemo(() => computeSegments(photos), [photos])
  const hasDeclared = point.manual_segments.length > 0
  const declared = useMemo(() => (hasDeclared ? groupByDeclaredSegments(photos, point.manual_segments) : null), [hasDeclared, photos, point.manual_segments])

  // Horarios y "otras fotos" unificados en una sola lista — así se pueden
  // emparejar de a dos por fila (misma lógica sin importar si vienen de
  // horarios declarados o de la detección automática por EXIF).
  const segments: SegmentLike[] = useMemo(() => {
    if (declared) {
      const bucketSegs = declared.buckets.map((b) => ({
        key: b.start,
        label: `${b.start}–${b.end}`,
        photos: b.photos,
        forcedCapturedAt: new Date(`${eventDate}T${b.start}:00`).toISOString(),
      }))
      const leftoverSeg = declared.leftover.length > 0 ? [{ key: '__otras__', label: 'Otras fotos', photos: declared.leftover, dashed: true }] : []
      return [...bucketSegs, ...leftoverSeg]
    }
    if (autoSegments) return autoSegments.map((s) => ({ key: s.key, label: s.label, photos: s.photos }))
    return []
  }, [declared, autoSegments, eventDate])

  const segmentRows = useMemo(() => chunk(segments, 2), [segments])

  function toggleRow(rowIndex: number) {
    setOpenRows((prev) => {
      const next = new Set(prev)
      if (next.has(rowIndex)) next.delete(rowIndex)
      else next.add(rowIndex)
      return next
    })
  }

  function showMoreRow(rowIndex: number) {
    setVisibleRowsByRow((prev) => ({ ...prev, [rowIndex]: (prev[rowIndex] ?? 1) + 1 }))
  }

  function chooseUploadSegment(segKey: string) {
    setSegmentUploadOpen(segKey)
    setUploadPickerOpen(false)
    const idx = segments.findIndex((s) => s.key === segKey)
    if (idx >= 0) setOpenRows((prev) => new Set(prev).add(Math.floor(idx / 2)))
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <SelectMenu ids={photos.map((p) => p.id)} selectedIds={selectedIds} onSelectMany={onSelectMany} onDeselectMany={onDeselectMany} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (hasDeclared ? setUploadPickerOpen((o) => !o) : setUploadOpen((o) => !o))}
            >
              {(hasDeclared ? uploadPickerOpen : uploadOpen) ? 'Cerrar' : '+ Subir fotos'}
            </Button>
          </div>

          {uploadPickerOpen && hasDeclared && (
            <div className="mb-6 rounded-2xl border border-border p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">¿Para qué horario son estas fotos?</p>
              <div className="grid grid-cols-3 gap-2">
                {point.manual_segments.map((seg) => (
                  <button
                    key={seg.start}
                    onClick={() => chooseUploadSegment(seg.start)}
                    className="rounded-full border border-border px-2 py-1.5 text-center text-xs font-semibold transition-colors hover:border-foreground hover:text-foreground"
                  >
                    {seg.start}–{seg.end}
                  </button>
                ))}
              </div>
            </div>
          )}

          {uploadOpen && !hasDeclared && (
            <div className="mb-6">
              <PhotoUploadQueue eventId={eventId} pointId={point.id} photographerId={photographerId} price={price} watermarkPath={watermarkPath} onItemUploaded={onUploaded} />
              <p className="mt-2 text-xs text-muted-foreground">Se clasifican solas por hora si la foto trae EXIF.</p>
            </div>
          )}

          {photos.length === 0 && segments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay fotos en este punto.</p>
          ) : segments.length > 0 ? (
            <div className="flex flex-col gap-3">
              {segmentRows.map((row, rowIndex) => (
                <div key={rowIndex} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {row.map((seg) => (
                    <div key={seg.key} className={cn('rounded-2xl border border-border', seg.dashed && 'border-dashed')}>
                      <div className="flex w-full flex-wrap items-center justify-between gap-2 p-3">
                        <button onClick={() => toggleRow(rowIndex)} className="flex flex-1 items-center justify-between gap-3 text-left">
                          <p className="text-sm font-semibold">{seg.label} <span className="font-normal text-muted-foreground">· {seg.photos.length} fotos</span></p>
                          <span className={cn('text-xs transition-transform', openRows.has(rowIndex) && 'rotate-180')}>▾</span>
                        </button>
                        <div className="flex shrink-0 items-center gap-2">
                          <SelectMenu ids={seg.photos.map((p) => p.id)} selectedIds={selectedIds} onSelectMany={onSelectMany} onDeselectMany={onDeselectMany} />
                          {seg.forcedCapturedAt && (
                            <button
                              onClick={() => setSegmentUploadOpen((k) => (k === seg.key ? null : seg.key))}
                              className="rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:border-foreground hover:text-foreground"
                            >
                              {segmentUploadOpen === seg.key ? 'Cerrar' : 'Cargar fotos'}
                            </button>
                          )}
                        </div>
                      </div>
                      {segmentUploadOpen === seg.key && seg.forcedCapturedAt && (
                        <div className="border-t border-border p-3">
                          <PhotoUploadQueue
                            eventId={eventId}
                            pointId={point.id}
                            photographerId={photographerId}
                            price={price}
                            watermarkPath={watermarkPath}
                            onItemUploaded={onUploaded}
                            forcedCapturedAt={seg.forcedCapturedAt}
                          />
                        </div>
                      )}
                      {openRows.has(rowIndex) && seg.photos.length > 0 && (
                        <div className="border-t border-border p-3">
                          <GalleryRows
                            photos={seg.photos}
                            selectedIds={selectedIds}
                            onToggleSelect={onToggleSelect}
                            visibleRows={visibleRowsByRow[rowIndex] ?? 1}
                            onShowMore={() => showMoreRow(rowIndex)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <GalleryRows photos={photos} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />
          )}
        </div>
      )}
    </div>
  )
}

/** Subir y organizar fotos por punto desde el propio creador/editor del
 * evento — antes solo era posible desde el visor, obligando a un segundo
 * viaje después de publicar. Escritorio: un punto por fila (igual que el
 * visor del evento); dentro de cada punto, sus horarios se muestran en
 * parejas por fila, cada uno con su propia expansión/paginación/selección,
 * sin sincronizar con ningún otro. Móvil: lista simple, cada punto
 * independiente, sin subir/seleccionar (solo revisar). */
export function EventImagesManager({ eventId, photographerId, price, watermarkPath, eventDate, points }: EventImagesManagerProps) {
  const { data: rawPhotos = [] } = useEventPhotosDetailed(eventId)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [assignHourOpen, setAssignHourOpen] = useState(false)
  const push = useToastStore((s) => s.push)

  // Siempre por nombre de archivo — es el correlativo real de la cámara, no
  // depende del orden en que se arrastraron los archivos al subirlos.
  const photos = useMemo(() => sortPhotosByFilename(rawPhotos), [rawPhotos])

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

  // Nunca mezclar en la misma selección fotos de puntos distintos — moverlas
  // o asignarles hora a la vez no tendría un único destino/punto de
  // referencia sensato. Deseleccionar siempre está permitido; agregar una
  // foto de otro punto mientras ya hay selección de uno distinto se bloquea.
  function pointOf(photoId: string): string | null {
    return photos.find((p) => p.id === photoId)?.point_id ?? null
  }

  function currentSelectionPoint(prev: Set<string>): string | null | undefined {
    if (prev.size === 0) return undefined
    const first = [...prev][0]
    return pointOf(first)
  }

  function toggleSelect(photoId: string) {
    setSelectedIds((prev) => {
      if (prev.has(photoId)) {
        const next = new Set(prev)
        next.delete(photoId)
        return next
      }
      const currentPoint = currentSelectionPoint(prev)
      if (currentPoint !== undefined && currentPoint !== pointOf(photoId)) {
        push({ type: 'error', title: 'No puedes mezclar puntos', description: 'Deselecciona las fotos del otro punto antes de elegir esta.' })
        return prev
      }
      const next = new Set(prev)
      next.add(photoId)
      return next
    })
  }

  function selectMany(ids: string[]) {
    if (ids.length === 0) return
    setSelectedIds((prev) => {
      const currentPoint = currentSelectionPoint(prev)
      if (currentPoint !== undefined && currentPoint !== pointOf(ids[0])) {
        push({ type: 'error', title: 'No puedes mezclar puntos', description: 'Deselecciona las fotos del otro punto antes de seleccionar este grupo.' })
        return prev
      }
      return new Set([...prev, ...ids])
    })
  }

  function deselectMany(ids: string[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
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

  // A qué punto pertenecen las fotos seleccionadas — nunca hay mezcla (ver
  // toggleSelect/selectMany), así que basta con mirar la primera. Se usa
  // para acotar los horarios del modal de "asignar hora" y para no ofrecer
  // el punto actual como destino en "Mover a…" (ya están ahí).
  const selectedPointId = useMemo(() => {
    if (selectedIds.size === 0) return null
    const [first] = selectedIds
    return photos.find((p) => p.id === first)?.point_id ?? null
  }, [selectedIds, photos])

  const assignHourPoint = useMemo(() => points.find((p) => p.id === selectedPointId) ?? null, [selectedPointId, points])

  // Reasignación manual de horario — para fotos sin EXIF (capturas de
  // pantalla, reenvíos de WhatsApp, exportaciones que perdieron los
  // metadatos). Escribe un `captured_at` sintético a partir de la fecha del
  // evento + la hora elegida, así el mismo algoritmo de segmentos las
  // clasifica solas de ahí en adelante — no hace falta una UI aparte.
  async function assignHour(time: string) {
    const ids = Array.from(selectedIds)
    const capturedAt = new Date(`${eventDate}T${time}:00`).toISOString()
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
      {/* Escritorio: un punto por fila. */}
      <div className="hidden lg:flex lg:flex-col lg:gap-4">
        {points.map((pt) => (
          <DesktopPointCard
            key={pt.id}
            point={pt}
            photos={photosByPoint.get(pt.id) ?? []}
            eventId={eventId}
            photographerId={photographerId}
            price={price}
            watermarkPath={watermarkPath}
            eventDate={eventDate}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectMany={selectMany}
            onDeselectMany={deselectMany}
            onUploaded={invalidatePhotos}
          />
        ))}
      </div>

      {/* Móvil: lista simple, solo lectura. */}
      <div className="flex flex-col gap-4 lg:hidden">
        {points.map((pt) => (
          <MobilePointRow key={pt.id} point={pt} photos={photosByPoint.get(pt.id) ?? []} />
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-30 hidden justify-center px-4 md:bottom-6 lg:flex">
          <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-border bg-background px-5 py-3 shadow-lg">
            <span className="text-sm font-semibold">{selectedIds.size} seleccionada{selectedIds.size > 1 ? 's' : ''}</span>
            <Dropdown
              label="Mover a…"
              onSelect={bulkMoveTo}
              options={points.filter((pt) => pt.id !== selectedPointId).map((pt) => ({ value: pt.id, label: pt.label }))}
            />
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
          <div className="relative z-10 w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="text-base font-bold">Asignar hora manualmente</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Para fotos sin hora de captura registrada (sin EXIF) — elige el horario declarado al que pertenecen.
            </p>

            {assignHourPoint && assignHourPoint.manual_segments.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Horarios de {assignHourPoint.label}</p>
                <div className="grid grid-cols-3 gap-2">
                  {assignHourPoint.manual_segments.map((seg) => (
                    <button
                      key={seg.start}
                      onClick={() => assignHour(seg.start)}
                      className="rounded-full border border-border px-2 py-1.5 text-center text-xs font-semibold transition-colors hover:border-foreground hover:text-foreground"
                    >
                      {seg.start}–{seg.end}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">
                {assignHourPoint
                  ? `${assignHourPoint.label} todavía no tiene horarios declarados — agrégalos en la pestaña "Ruta"/"Punto".`
                  : 'Selecciona fotos de un solo punto con horarios declarados para poder asignarles hora.'}
              </p>
            )}

            <div className="mt-5 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setAssignHourOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
