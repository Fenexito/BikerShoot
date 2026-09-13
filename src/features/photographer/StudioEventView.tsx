import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useEvent, useEventPhotosDetailed, type EventPhoto } from './useMyEvents'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { r2Url, previewUrl } from '../../lib/r2'
import { PhotoUploadQueue } from './components/PhotoUploadQueue'
import { FeaturedPhotosSection } from './components/FeaturedPhotosSection'
import { computeSegments } from './photoSegments'
import { groupByDeclaredSegments } from './photoGrouping'
import { sortPhotosByFilename } from './sortPhotos'
import { EVENT_STATUS_STYLE } from '../../lib/eventStatus'
import { Button } from '../../ui/studio/Button'
import { StatusPill } from '../../ui/shared/StatusPill'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { useToastStore } from '../../ui/overlays/toastStore'
import { confirmDialog } from '../../ui/overlays/confirmStore'
import { typedConfirmDialog } from '../../ui/overlays/typedConfirmStore'
import { PlaceholderPage } from '../auth/PlaceholderPage'
import { IconEdit } from '../../ui/shared/icons'
import { AnimateIcon } from '../../ui/animate-icons/icon'
import { Trash } from '../../ui/animate-icons/icons/Trash'
import { Play } from '../../ui/animate-icons/icons/Play'
import { Pause } from '../../ui/animate-icons/icons/Pause'
import { ChevronLeft } from '../../ui/animate-icons/icons/ChevronLeft'
import { ActionMenu } from '../../ui/shared/ActionMenu'
import { ScrollToTopButton } from '../../ui/shared/ScrollToTopButton'
import { Dropdown } from '../../ui/shared/Dropdown'
import { useAutoHideHeader } from '../../ui/shared/useAutoHideHeader'
import { useHeaderTransform } from '../../ui/layout/useHeaderTransform'
import { useBackButton } from '../../ui/shared/useBackButton'
import ScrollExpand from '../../ui/reactbits/ScrollExpand'
import AccordionGallery from '../../ui/reactbits/AccordionGallery'
import { cn } from '../../lib/cn'
import type { EventStatus } from '../../types/db'
import { Skeleton } from '../../ui/shared/Skeleton'

const PAGE_SIZE = 12
const HEADER_SCROLL_THRESHOLD = 200
// Borde inferior aproximado del header flotante en escritorio (top-4 = 16px
// + h-16 = 64px) — cuando el centinela de la portada cruza esta línea, el
// header ya puede transformarse.
const HEADER_BOTTOM_OFFSET = 84

function PhotoListRow({ photo, onDelete }: { photo: EventPhoto; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <img src={previewUrl(photo)} alt="" className="h-12 w-12 shrink-0 rounded-2xl border border-border object-cover" />
      <p className="min-w-0 flex-1 truncate text-sm" title={photo.original_filename ?? undefined}>
        {photo.original_filename ?? 'Sin nombre registrado'}
      </p>
      {photo.delivered_path && (
        <span className="shrink-0 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Vendida</span>
      )}
      <button onClick={() => onDelete(photo.id)} className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-accent">
        Eliminar
      </button>
    </div>
  )
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** El acordeón horizontal necesita ancho real para lucir bien (el efecto de
 * expandir un panel angosto no tiene sentido en una pantalla de celular) —
 * en móvil se reemplaza por una cuadrícula simple, solo para VER: ni
 * selección múltiple, ni subir, ni eliminar — esas acciones administrativas
 * quedan para escritorio. Lo único que el fotógrafo puede subir desde el
 * móvil son fotos destacadas (ver `FeaturedPhotosSection`). */
function MobileGridTile({ photo }: { photo: EventPhoto }) {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-muted">
      <img src={previewUrl(photo)} alt="" className="h-full w-full object-cover" />
      {photo.delivered_path && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
          Vendida
        </span>
      )}
    </div>
  )
}

/** Fila de la galería tipo "acordeón" (hover expande la foto activa) — el
 * mismo estilo visual que el fotógrafo ya tenía y quiso conservar. El
 * overlay (seleccionar + eliminar) vive encima, revelado solo con hover
 * vía `group-hover` (el panel de reactbits ya trae la clase `group`). */
function AccordionRow({
  photos,
  selectedIds,
  onToggleSelect,
  onDelete,
}: {
  photos: EventPhoto[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <AccordionGallery
      items={photos.map((photo) => ({
        image: previewUrl(photo),
        overlay: (
          <>
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
            <AnimateIcon animateOnHover animateOnTap asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(photo.id)
                }}
                aria-label="Eliminar foto"
                className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white opacity-100 transition-colors sm:opacity-0 sm:hover:bg-red-500 sm:group-hover:opacity-100"
              >
                <Trash size={14} />
              </button>
            </AnimateIcon>
          </>
        ),
      }))}
      onPanelClick={(i) => onToggleSelect(photos[i].id)}
      height={260}
      radius={16}
      expandRatio={0.3}
      tilt={6}
      parallax={0.3}
      accentColor="rgb(255 61 0)"
      overlayColor="#000000"
      showLabels={false}
      defaultIndex={0}
    />
  )
}

interface PhotoGalleryProps {
  photos: EventPhoto[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onDelete: (id: string) => void
}

function PhotoGallery({
  photos,
  selectedIds,
  onToggleSelect,
  onDelete,
  visibleCount: visibleCountProp,
  onShowMore: onShowMoreProp,
}: PhotoGalleryProps & { visibleCount?: number; onShowMore?: () => void }) {
  const [visibleCountState, setVisibleCountState] = useState(PAGE_SIZE)
  const visibleCount = visibleCountProp ?? visibleCountState
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const loadMoreZoneRef = useRef<HTMLDivElement>(null)
  const visible = photos.slice(0, visibleCount)

  if (photos.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay fotos en este punto.</p>
  }

  function handleLoadMore() {
    const prevTop = loadMoreZoneRef.current?.getBoundingClientRect().top ?? 0
    if (onShowMoreProp) onShowMoreProp()
    else setVisibleCountState((c) => c + PAGE_SIZE)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const newTop = loadMoreZoneRef.current?.getBoundingClientRect().top
        if (newTop != null) window.scrollBy({ top: newTop - prevTop, behavior: 'smooth' })
      })
    })
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground sm:hidden">Subir y eliminar fotos está disponible en escritorio</p>
        <div className="hidden gap-1 rounded-full bg-muted p-1 sm:flex">
          <button
            onClick={() => setView('grid')}
            className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-colors', view === 'grid' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
          >
            Grid
          </button>
          <button
            onClick={() => setView('list')}
            className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-colors', view === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
          >
            Lista
          </button>
        </div>
      </div>

      {/* Móvil: cuadrícula simple, sin selección múltiple ni vista de lista. */}
      <div className="grid grid-cols-3 gap-2 sm:hidden">
        {visible.map((photo) => (
          <MobileGridTile key={photo.id} photo={photo} />
        ))}
      </div>

      <div className="hidden sm:block">
        {view === 'grid' ? (
          <div className="flex flex-col gap-3">
            {chunk(visible, PAGE_SIZE).map((rowPhotos, i) => (
              <AccordionRow key={i} photos={rowPhotos} selectedIds={selectedIds} onToggleSelect={onToggleSelect} onDelete={onDelete} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border rounded-2xl border border-border">
            {visible.map((photo) => (
              <PhotoListRow key={photo.id} photo={photo} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>

      {/* Zona ancla siempre presente (con o sin botón) — así el scroll a la
          última fila funciona incluso cuando "ver más" ya no tiene sentido
          por no quedar más fotos. */}
      <div ref={loadMoreZoneRef}>
        {visibleCount < photos.length && (
          <button
            onClick={handleLoadMore}
            className="mt-4 w-full rounded-2xl border border-border py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            Ver más fotos ({photos.length - visibleCount} más)
          </button>
        )}
      </div>
    </div>
  )
}

function PointStack({ photos }: { photos: EventPhoto[] }) {
  const preview = photos.slice(0, 3)
  if (preview.length === 0) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-dashed border-border text-lg opacity-40">
        📷
      </div>
    )
  }
  return (
    <div className="relative h-16 w-16 shrink-0">
      {preview.map((photo, i) => (
        <img
          key={photo.id}
          src={previewUrl(photo)}
          alt=""
          className="absolute h-14 w-14 rounded-2xl border-2 border-background object-cover shadow-sm"
          style={{ left: i * 8, top: i * 6, zIndex: preview.length - i }}
        />
      ))}
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

interface SegmentLike {
  key: string
  label: string
  photos: EventPhoto[]
  forcedCapturedAt?: string
  dashed?: boolean
}

interface PointCardProps {
  point: { id: string; label: string; time_start: string; time_end: string; manual_segments?: { start: string; end: string }[] | null }
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
  onDelete: (id: string) => void
  onUploaded: () => void
  registerRef?: (el: HTMLDivElement | null) => void
  onExpandedChange?: (expanded: boolean) => void
}

function PointCard({ point, photos, eventId, photographerId, price, watermarkPath, eventDate, selectedIds, onToggleSelect, onSelectMany, onDeselectMany, onDelete, onUploaded, registerRef, onExpandedChange }: PointCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [segmentUploadOpen, setSegmentUploadOpen] = useState<string | null>(null)
  const [visibleCountByRow, setVisibleCountByRow] = useState<Record<number, number>>({})
  const sold = photos.filter((p) => p.delivered_path).length
  const hasDeclared = (point.manual_segments?.length ?? 0) > 0
  const declared = useMemo(() => (hasDeclared ? groupByDeclaredSegments(photos, point.manual_segments!) : null), [hasDeclared, photos, point.manual_segments])
  const autoSegments = useMemo(() => (hasDeclared ? null : computeSegments(photos)), [hasDeclared, photos])

  // Horarios y "otras fotos" unificados — permite emparejar de a dos por
  // fila (mismos "gemelos" del editor) sin importar si vienen de horarios
  // declarados o de la detección automática por EXIF.
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

  function showMoreRow(rowIndex: number) {
    setVisibleCountByRow((prev) => ({ ...prev, [rowIndex]: (prev[rowIndex] ?? PAGE_SIZE) + PAGE_SIZE }))
  }

  function toggleExpanded() {
    setExpanded((e) => {
      onExpandedChange?.(!e)
      return !e
    })
  }

  return (
    <div ref={registerRef} className="overflow-hidden rounded-3xl border border-border bg-card transition-colors hover:border-border-hover">
      <button onClick={toggleExpanded} className="flex w-full flex-wrap items-center gap-4 p-5 text-left">
        <PointStack photos={photos} />
        <div className="min-w-0 flex-1">
          <h2 className="font-studio text-lg font-bold tracking-tight2">{point.label}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {point.time_start.slice(0, 5)} – {point.time_end.slice(0, 5)} · {photos.length} fotos
            {sold > 0 && ` · ${sold} vendidas`}
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
          <div className="mb-4 hidden items-center justify-between sm:flex">
            <SelectMenu ids={photos.map((p) => p.id)} selectedIds={selectedIds} onSelectMany={onSelectMany} onDeselectMany={onDeselectMany} />
            <Button variant="ghost" size="sm" onClick={() => setUploadOpen((o) => !o)}>
              {uploadOpen ? 'Cerrar' : '+ Subir fotos a este punto'}
            </Button>
          </div>

          {uploadOpen && (
            <div className="mb-6">
              <PhotoUploadQueue
                eventId={eventId}
                pointId={point.id}
                photographerId={photographerId}
                price={price}
                watermarkPath={watermarkPath}
                onItemUploaded={onUploaded}
                manualSegments={hasDeclared ? point.manual_segments! : undefined}
                eventDate={eventDate}
              />
              <p className="mt-2 hidden text-xs text-muted-foreground sm:block">
                {hasDeclared ? 'Se te preguntará a qué horario pertenecen antes de subirlas.' : 'Se clasifican solas por hora si la foto trae EXIF.'}
              </p>
            </div>
          )}

          {segments.length > 0 ? (
            <div className="flex flex-col gap-3">
              {segmentRows.map((row, rowIndex) => (
                <div key={rowIndex} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {row.map((seg) => (
                    <div key={seg.key} className={cn('rounded-2xl border border-border', seg.dashed && 'border-dashed')}>
                      <div className="hidden flex-wrap items-center justify-between gap-2 p-3 sm:flex">
                        <p className="text-sm font-semibold">{seg.label} <span className="font-normal text-muted-foreground">· {seg.photos.length} fotos</span></p>
                        <div className="flex items-center gap-2">
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
                      <p className="p-3 text-sm font-semibold sm:hidden">{seg.label} <span className="font-normal text-muted-foreground">· {seg.photos.length} fotos</span></p>
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
                      <div className="border-t border-border p-3">
                        <PhotoGallery
                          photos={seg.photos}
                          selectedIds={selectedIds}
                          onToggleSelect={onToggleSelect}
                          onDelete={onDelete}
                          visibleCount={visibleCountByRow[rowIndex] ?? PAGE_SIZE}
                          onShowMore={() => showMoreRow(rowIndex)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <PhotoGallery photos={photos} selectedIds={selectedIds} onToggleSelect={onToggleSelect} onDelete={onDelete} />
          )}
        </div>
      )}
    </div>
  )
}

export function StudioEventView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const push = useToastStore((s) => s.push)
  useBackButton('/studio/eventos')
  const { data: event, isLoading } = useEvent(id)
  const { data: photos = [] } = useEventPhotosDetailed(id)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [assignHourOpen, setAssignHourOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activePointLabel, setActivePointLabel] = useState<string | null>(null)
  const [coverPassed, setCoverPassed] = useState(false)
  const headerHidden = useAutoHideHeader()
  const pointRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const expandedPointsRef = useRef<Set<string>>(new Set())
  const eventPointsRef = useRef<{ id: string; label: string }[]>([])
  const coverSentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // "Destacadas" se trata como un punto más para efectos del header
    // pegajoso — si el fotógrafo está haciendo scroll dentro de esa sección
    // también debe ver su nombre ahí, igual que con cualquier punto real.
    eventPointsRef.current = [{ id: '__featured__', label: 'Destacadas' }, ...(event?.event_points ?? [])]
  }, [event])

  function handlePointExpandedChange(pointId: string, expanded: boolean) {
    if (expanded) expandedPointsRef.current.add(pointId)
    else expandedPointsRef.current.delete(pointId)
  }

  useEffect(() => {
    // Mientras el fotógrafo hace scroll DENTRO de un punto abierto (con
    // cientos de fotos, el punto se pierde de vista rápido), el header
    // pegajoso muestra su nombre — solo mientras ese punto sigue cruzando
    // la línea justo debajo del propio header. Se calcula con refs (no
    // estado) para no tener que re-registrar el listener en cada render.
    const STICKY_BAR_BOTTOM = 168
    function onScroll() {
      setScrolled(window.scrollY > HEADER_SCROLL_THRESHOLD)
      // El header se transforma cuando la portada (imagen o el bloque
      // genérico sin portada) ya terminó de pasar bajo el header flotante —
      // no un umbral fijo arbitrario, sino la posición real de este
      // centinela colocado justo después de la portada.
      const sentinelTop = coverSentinelRef.current?.getBoundingClientRect().top
      if (sentinelTop != null) setCoverPassed(sentinelTop <= HEADER_BOTTOM_OFFSET)
      let current: string | null = null
      for (const pt of eventPointsRef.current) {
        if (!expandedPointsRef.current.has(pt.id)) continue
        const el = pointRefs.current[pt.id]
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top <= STICKY_BAR_BOTTOM && rect.bottom >= STICKY_BAR_BOTTOM) {
          current = pt.label
          break
        }
      }
      setActivePointLabel(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const photosByPoint = useMemo(() => {
    const map = new Map<string, EventPhoto[]>()
    // Siempre por nombre de archivo — el correlativo real de la cámara, no
    // el orden en que se subieron/arrastraron los archivos.
    for (const p of sortPhotosByFilename(photos)) {
      // Las destacadas viven en su propia sección — nunca deben colarse en
      // "sin punto asignado" solo porque comparten point_id null.
      if (p.featured) continue
      const key = p.point_id ?? '__none__'
      const list = map.get(key) ?? []
      list.push(p)
      map.set(key, list)
    }
    return map
  }, [photos])

  // Nunca mezclar en la misma selección fotos de puntos distintos (incluye
  // "sin punto asignado", con clave '__none__') — moverlas o asignarles hora
  // a la vez no tendría un único destino sensato. Deseleccionar siempre está
  // permitido; agregar una foto de otro punto mientras ya hay selección de
  // uno distinto se bloquea con un aviso.
  function pointKeyOf(photoId: string): string {
    return photos.find((p) => p.id === photoId)?.point_id ?? '__none__'
  }

  function currentSelectionPointKey(prev: Set<string>): string | undefined {
    if (prev.size === 0) return undefined
    const [first] = prev
    return pointKeyOf(first)
  }

  function toggleSelect(photoId: string) {
    setSelectedIds((prev) => {
      if (prev.has(photoId)) {
        const next = new Set(prev)
        next.delete(photoId)
        return next
      }
      const currentKey = currentSelectionPointKey(prev)
      if (currentKey !== undefined && currentKey !== pointKeyOf(photoId)) {
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
      const currentKey = currentSelectionPointKey(prev)
      if (currentKey !== undefined && currentKey !== pointKeyOf(ids[0])) {
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
    queryClient.invalidateQueries({ queryKey: ['event-photos-detailed', id] })
    queryClient.invalidateQueries({ queryKey: ['my-events', user?.id] })
  }

  async function deletePhoto(photoId: string) {
    const ok = await confirmDialog.ask({ title: '¿Eliminar esta foto?', confirmLabel: 'Eliminar', tone: 'danger' })
    if (!ok) return
    const { error } = await supabase.from('photos').delete().eq('id', photoId)
    if (error) {
      if (error.code === '23503') {
        push({ type: 'error', title: 'No se puede eliminar', description: 'Esta foto ya fue vendida.' })
      } else {
        push({ type: 'error', title: 'No se pudo eliminar', description: error.message })
      }
      return
    }
    push({ type: 'success', title: 'Foto eliminada' })
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(photoId)
      return next
    })
    invalidatePhotos()
  }

  async function bulkMoveTo(pointId: string) {
    if (!pointId) return
    const ids = Array.from(selectedIds)
    const { error } = await supabase.from('photos').update({ point_id: pointId === '__none__' ? null : pointId }).in('id', ids)
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
  const selectedPointKey = useMemo(() => {
    if (selectedIds.size === 0) return null
    const [first] = selectedIds
    return photos.find((p) => p.id === first)?.point_id ?? '__none__'
  }, [selectedIds, photos])

  const assignHourPoint = useMemo(() => event?.event_points.find((p) => p.id === selectedPointKey) ?? null, [selectedPointKey, event])

  // Reasignación manual de horario — para fotos sin EXIF (capturas de
  // pantalla, reenvíos de WhatsApp, exportaciones que perdieron los
  // metadatos). Escribe un `captured_at` sintético a partir de la fecha del
  // evento + el horario declarado elegido, así el mismo agrupador por
  // segmentos las clasifica solas de ahí en adelante.
  async function assignHour(time: string) {
    if (!event) return
    const ids = Array.from(selectedIds)
    const capturedAt = new Date(`${event.event_date}T${time}:00`).toISOString()
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

  async function toggleStatus(next: EventStatus) {
    const { error } = await supabase.from('events').update({ status: next }).eq('id', id)
    if (error) {
      push({ type: 'error', title: 'No se pudo actualizar', description: error.message })
      return
    }
    push({ type: 'success', title: next === 'pausado' ? 'Evento pausado — oculto del público' : 'Evento publicado' })
    queryClient.invalidateQueries({ queryKey: ['event', id] })
    queryClient.invalidateQueries({ queryKey: ['my-events', user?.id] })
  }

  async function deleteEvent() {
    if (!event) return
    const { confirmed } = await typedConfirmDialog.ask({
      title: `Esto elimina "${event.title}" por completo, incluyendo todas sus fotos (vendidas o no).`,
      description: 'Los bikers que ya compraron fotos de este evento conservan su entrega — esto no les quita nada.',
      matchText: event.title,
      confirmLabel: 'Eliminar evento',
    })
    if (!confirmed) return
    const { error } = await supabase.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', event.id)
    if (error) {
      push({ type: 'error', title: 'No se pudo eliminar', description: error.message })
      return
    }
    push({ type: 'success', title: 'Evento eliminado' })
    queryClient.invalidateQueries({ queryKey: ['my-events', user?.id] })
    navigate('/studio/eventos')
  }

  // El header (HeaderStudio) se transforma cuando la portada ya terminó de
  // pasar bajo el header (ver `coverPassed`, no un scroll fijo) — muestra
  // esta misma info que hoy vive en la barra pegajoja compacta de la página
  // (estado, nombre, pausar/publicar, acciones). Se registra antes de los
  // `return` tempranos de abajo — los hooks no pueden depender de si
  // `event` ya cargó.
  useHeaderTransform(
    event ? (
      <div className="flex w-full min-w-0 items-center gap-3">
        <StatusPill
          dot={EVENT_STATUS_STYLE[event.status].dot}
          text={EVENT_STATUS_STYLE[event.status].text}
          label={EVENT_STATUS_STYLE[event.status].label}
          className="hidden shrink-0 text-xs font-bold uppercase tracking-wide lg:flex"
        />
        <p className="min-w-0 flex-1 truncate text-base font-bold">
          {event.title}
          {activePointLabel && <span className="ml-2 text-sm font-normal text-muted-foreground">· 📍 {activePointLabel}</span>}
        </p>
        {event.status === 'pausado' ? (
          <button
            onClick={() => toggleStatus('activo')}
            className="shrink-0 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-500"
          >
            Publicar
          </button>
        ) : (
          <button
            onClick={() => toggleStatus('pausado')}
            className="shrink-0 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-500"
          >
            Pausar
          </button>
        )}
        <ActionMenu
          items={[
            { to: `/studio/eventos/${id}/editar`, label: 'Editar evento', icon: <IconEdit className="h-4 w-4" /> },
            { onClick: deleteEvent, label: 'Eliminar evento', icon: <Trash size={16} />, tone: 'danger' },
          ]}
        />
      </div>
    ) : null,
    coverPassed,
  )

  if (isLoading) {
    return (
      <div>
        <div className="h-[360px] w-full animate-pulse bg-muted md:h-[420px]" />
        <div className={STUDIO_PAGE_WIDE}>
          <Skeleton className="mt-6 h-6 w-72" />
          <div className="mt-8 flex flex-col gap-3">
            <Skeleton className="h-24 w-full rounded-3xl" />
            <Skeleton className="h-24 w-full rounded-3xl" />
            <Skeleton className="h-24 w-full rounded-3xl" />
          </div>
        </div>
      </div>
    )
  }
  if (!event) return <PlaceholderPage title="Evento no encontrado" />

  const statusStyle = EVENT_STATUS_STYLE[event.status]
  const unassigned = photosByPoint.get('__none__') ?? []
  const coverUrl = event.cover_path ? r2Url(event.cover_path) : null

  return (
    <>
      {coverUrl ? (
        <ScrollExpand
          // El header sí ocupa espacio real en el flujo en escritorio
          // (a diferencia de móvil, donde es `fixed` y flota encima) —
          // sin este margen negativo (mismo espíritu que el de móvil,
          // ajustado a la altura real del header en escritorio: 16px de
          // separación + 64px de alto = 80px) la portada quedaba empujada
          // hacia abajo en vez de llegar al borde superior de la página.
          className="-mt-[4.75rem] md:-mt-20"
          src={coverUrl}
          alt={event.title}
          title={event.title}
          scrollHint="Desliza para ver el evento"
          useWindowScroll
          startWidth={60}
          startHeight={60}
          startRadius={36}
          endRadius={1}
          mediaZoom={1.5}
          scrollDistance={1}
          holdDistance={0.08}
          smoothing={0.3}
          overlayScrim={0.5}
        />
      ) : (
        <div className="relative flex h-[280px] w-full items-center justify-center overflow-hidden bg-muted md:h-[380px]">
          <span className="text-5xl opacity-20">📷</span>
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 to-transparent" />
        </div>
      )}

      <div className={STUDIO_PAGE_WIDE}>
        <div
          className={cn(
            // Solo pegajosa en móvil — en escritorio ese rol ya lo cumple el
            // header transformado (mismo estado/nombre/pausar/acciones), así
            // que aquí basta con quedarse en el flujo normal (sin sticky, sin
            // z-index elevado) para no tener dos barras encimadas.
            'sticky z-20 mt-6 transition-[top] duration-300 sm:static sm:z-auto',
            headerHidden ? 'top-3' : 'top-[4.75rem]',
          )}
        >
          {/* Móvil: flecha atrás, nombre del evento, y estado + menú de tres
              puntos alineados a la derecha — la barra de stats y el
              thumbnail no caben cómodos aquí, y pausar/publicar se mueve
              dentro del menú. */}
          <div className="flex items-center gap-3 rounded-full border border-border bg-background/95 px-3 py-2.5 shadow-sm backdrop-blur-md sm:hidden">
            <AnimateIcon animateOnHover animateOnTap asChild>
              <button onClick={() => navigate('/studio/eventos')} aria-label="Volver" className="flex h-8 w-8 shrink-0 items-center justify-center text-foreground transition-colors hover:text-muted-foreground">
                <ChevronLeft size={20} strokeWidth={2.5} />
              </button>
            </AnimateIcon>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-bold tracking-tight2">{event.title}</h1>
              {scrolled && activePointLabel && <p className="mt-0.5 truncate text-xs text-muted-foreground">📍 {activePointLabel}</p>}
            </div>
            <StatusPill dot={statusStyle.dot} text={statusStyle.text} label={statusStyle.label} className="shrink-0 text-[9px] uppercase tracking-wide" />
            <ActionMenu
              items={[
                event.status === 'pausado'
                  ? { onClick: () => toggleStatus('activo'), label: 'Publicar evento', icon: <Play size={16} /> }
                  : { onClick: () => toggleStatus('pausado'), label: 'Pausar evento', icon: <Pause size={16} /> },
                { to: `/studio/eventos/${id}/editar`, label: 'Editar evento', icon: <IconEdit className="h-4 w-4" /> },
                { onClick: deleteEvent, label: 'Eliminar evento', icon: <Trash size={16} />, tone: 'danger' },
              ]}
            />
          </div>

          {/* Este es el bloque cuya posición dispara la transformación del
              header (ver `coverSentinelRef` / `coverPassed`) — el header se
              transforma justo cuando ESTE bloque (el que antes quedaba
              pegajoso) llega a la altura del header real, para que nunca se
              vean dos barras iguales a la vez. */}
          <div
            ref={coverSentinelRef}
            className={cn(
              'hidden rounded-3xl border border-border bg-background/95 shadow-sm backdrop-blur-md transition-all duration-300 sm:block',
              scrolled ? 'px-4 py-2.5' : 'px-5 py-5 sm:px-6',
            )}
          >
            <div className="flex items-center gap-4">
              <div className={cn('shrink-0 overflow-hidden rounded-2xl bg-muted transition-all duration-300', scrolled ? 'h-10 w-10' : 'h-16 w-16')}>
                {coverUrl ? <img src={coverUrl} alt="" className="h-full w-full object-cover" /> : (
                  <div className="flex h-full w-full items-center justify-center text-lg opacity-30">📷</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill dot={statusStyle.dot} text={statusStyle.text} label={statusStyle.label} className="shrink-0 text-[10px] uppercase tracking-wide" />
                  <h1 className={cn('truncate font-studio font-bold tracking-tight2 transition-all duration-300', scrolled ? 'text-base' : 'text-2xl md:text-3xl')}>
                    {event.title}
                  </h1>
                </div>
                {!scrolled && (
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {event.city}
                    {event.venue ? ` · ${event.venue}` : ''} · {new Date(event.event_date).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                )}
                {scrolled && activePointLabel && <p className="mt-0.5 truncate text-xs text-muted-foreground">📍 {activePointLabel}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {event.status === 'pausado' ? (
                  <button
                    onClick={() => toggleStatus('activo')}
                    className={cn('rounded-full bg-emerald-600 font-bold text-white transition-colors hover:bg-emerald-500', scrolled ? 'px-3 py-2 text-[11px]' : 'px-5 py-2.5 text-xs')}
                  >
                    Publicar
                  </button>
                ) : (
                  <button
                    onClick={() => toggleStatus('pausado')}
                    className={cn('rounded-full bg-blue-600 font-bold text-white transition-colors hover:bg-blue-500', scrolled ? 'px-3 py-2 text-[11px]' : 'px-5 py-2.5 text-xs')}
                  >
                    Pausar
                  </button>
                )}
                <ActionMenu
                  items={[
                    { to: `/studio/eventos/${id}/editar`, label: 'Editar evento', icon: <IconEdit className="h-4 w-4" /> },
                    { onClick: deleteEvent, label: 'Eliminar evento', icon: <Trash size={16} />, tone: 'danger' },
                  ]}
                />
              </div>
            </div>

            {!scrolled && (
              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
                <div>
                  <p className="font-studio text-xl font-bold">Q{event.price_per_photo}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Por foto</p>
                </div>
                <div>
                  <p className="font-studio text-xl font-bold">{event.event_points.length}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Puntos</p>
                </div>
                <div>
                  <p className="font-studio text-xl font-bold">{photos.length}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fotos</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {event.description && <p className="mt-6 max-w-2xl text-muted-foreground">{event.description}</p>}

        <div className="mt-10 flex flex-col gap-4 pb-24">
          <FeaturedPhotosSection
            eventId={event.id}
            photographerId={event.photographer_id}
            registerRef={(el) => (pointRefs.current['__featured__'] = el)}
            onExpandedChange={(exp) => handlePointExpandedChange('__featured__', exp)}
          />

          {event.event_points.map((pt) => (
            <PointCard
              key={pt.id}
              point={pt}
              photos={photosByPoint.get(pt.id) ?? []}
              eventId={event.id}
              photographerId={event.photographer_id}
              price={event.price_per_photo}
              watermarkPath={event.watermark_path}
              eventDate={event.event_date}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onSelectMany={selectMany}
              onDeselectMany={deselectMany}
              onDelete={deletePhoto}
              onUploaded={invalidatePhotos}
              registerRef={(el) => (pointRefs.current[pt.id] = el)}
              onExpandedChange={(exp) => handlePointExpandedChange(pt.id, exp)}
            />
          ))}

          {unassigned.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-studio text-lg font-bold tracking-tight2">Sin punto asignado</h2>
                <SelectMenu ids={unassigned.map((p) => p.id)} selectedIds={selectedIds} onSelectMany={selectMany} onDeselectMany={deselectMany} />
              </div>
              <PhotoGallery photos={unassigned} selectedIds={selectedIds} onToggleSelect={toggleSelect} onDelete={deletePhoto} />
            </div>
          )}

          {event.event_points.length === 0 && (
            <p className="text-muted-foreground">
              Este evento no tiene puntos de cobertura todavía —{' '}
              <Link to={`/studio/eventos/${id}/editar`} className="text-accent underline">agrégalos editando el evento</Link>.
            </p>
          )}
        </div>
      </div>

      <ScrollToTopButton />

      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 md:bottom-6">
          <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-border bg-background px-5 py-3 shadow-lg">
            <span className="text-sm font-semibold">{selectedIds.size} seleccionada{selectedIds.size > 1 ? 's' : ''}</span>
            <Dropdown
              label="Mover a…"
              onSelect={bulkMoveTo}
              options={[
                ...event.event_points.map((pt) => ({ value: pt.id, label: pt.label })),
                { value: '__none__', label: 'Sin punto asignado' },
              ].filter((opt) => opt.value !== selectedPointKey)}
            />
            <button
              onClick={() => setAssignHourOpen(true)}
              className="rounded-full border border-border bg-background px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-muted"
            >
              Asignar hora
            </button>
            <AnimateIcon animateOnHover animateOnTap asChild>
              <button
                onClick={bulkDelete}
                className="flex items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500"
              >
                <Trash size={14} />
                Eliminar
              </button>
            </AnimateIcon>
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

            {assignHourPoint && (assignHourPoint.manual_segments?.length ?? 0) > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Horarios de {assignHourPoint.label}</p>
                <div className="grid grid-cols-3 gap-2">
                  {assignHourPoint.manual_segments!.map((seg) => (
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
                  ? `${assignHourPoint.label} todavía no tiene horarios declarados — agrégalos en la pestaña "Ruta"/"Punto" del editor.`
                  : 'Selecciona fotos de un solo punto con horarios declarados para poder asignarles hora.'}
              </p>
            )}

            <div className="mt-5 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setAssignHourOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
