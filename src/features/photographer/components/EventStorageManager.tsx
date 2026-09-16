import { useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { queryClient } from '../../../lib/queryClient'
import { useEventStorageTree, type EventPointNode, type EventHorarioNode } from '../useEventStorageTree'
import { useFeaturedPhotosManager, MAX_FEATURED } from '../useFeaturedPhotosManager'
import { PhotoUploadQueue } from './PhotoUploadQueue'
import { TreeRow, TreeChildren } from '../../../ui/shared/Tree'
import { CleanupControl, type CleanupTarget } from '../../../ui/shared/CleanupControl'
import { DownloadRawControl } from '../../../ui/shared/DownloadRawControl'
import { PhotoListView, type PhotoListRow } from '../../../ui/shared/PhotoListView'
import { FancySelect } from '../../../ui/shared/FancySelect'
import { Button } from '../../../ui/studio/Button'
import { SkeletonRows } from '../../../ui/shared/Skeleton'
import { useToastStore } from '../../../ui/overlays/toastStore'
import { confirmDialog } from '../../../ui/overlays/confirmStore'

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

type Node =
  | { kind: 'featured' }
  | { kind: 'point'; point: EventPointNode }
  | { kind: 'horario'; point: EventPointNode; horario: EventHorarioNode }
  | { kind: 'leftover'; point: EventPointNode }

function pointKeyOf(point: EventPointNode) {
  return `point:${point.id ?? 'unassigned'}`
}
function leftoverKeyOf(point: EventPointNode) {
  return `leftover:${point.id ?? 'unassigned'}`
}

function findNode(key: string | null, points: EventPointNode[]): Node | null {
  if (!key) return null
  if (key === 'featured') return { kind: 'featured' }
  const [kind, ...rest] = key.split(':')
  if (kind === 'point') {
    const pointId = rest.join(':')
    const point = points.find((p) => (p.id ?? 'unassigned') === pointId)
    return point ? { kind: 'point', point } : null
  }
  if (kind === 'horario') {
    const horarioKey = rest.join(':')
    for (const point of points) {
      const horario = point.horarios.find((h) => h.key === horarioKey)
      if (horario) return { kind: 'horario', point, horario }
    }
    return null
  }
  if (kind === 'leftover') {
    const pointId = rest.join(':')
    const point = points.find((p) => (p.id ?? 'unassigned') === pointId)
    return point?.leftover && point.leftover.totalPhotos > 0 ? { kind: 'leftover', point } : null
  }
  return null
}

function invalidateEventStorage(eventId: string) {
  queryClient.invalidateQueries({ queryKey: ['event-storage-tree', eventId] })
  queryClient.invalidateQueries({ queryKey: ['event-photos-detailed', eventId] })
  queryClient.invalidateQueries({ queryKey: ['event-featured-photos', eventId] })
  queryClient.invalidateQueries({ queryKey: ['my-events'] })
  queryClient.invalidateQueries({ queryKey: ['photographer-usage-bytes'] })
}

const UNASSIGNED = '__unassigned__'

/** Destino de "mover" — cualquier otro punto del evento, o un horario
 * específico dentro de él (que además reescribe `captured_at` al inicio de
 * ese horario, mismo criterio que `assignHour` en el visor de evento). */
function buildMoveOptions(points: EventPointNode[], excludePointId: string | null) {
  const options: { value: string; label: string }[] = []
  for (const point of points) {
    const pid = point.id ?? UNASSIGNED
    if (pid === (excludePointId ?? UNASSIGNED)) continue
    options.push({ value: pid, label: point.label })
    for (const h of point.horarios) {
      options.push({ value: `${pid}::${h.start}`, label: `${point.label} · ${h.start}–${h.end}` })
    }
  }
  if (excludePointId !== null) options.push({ value: UNASSIGNED, label: 'Sin punto asignado' })
  return options
}

function MoveSelectedControl({ eventDate, points, sourcePointId, photoIds, onDone }: { eventDate: string; points: EventPointNode[]; sourcePointId: string | null; photoIds: string[]; onDone: () => void }) {
  const push = useToastStore((s) => s.push)
  const [dest, setDest] = useState('')
  const [busy, setBusy] = useState(false)
  const options = buildMoveOptions(points, sourcePointId)
  const destLabel = options.find((o) => o.value === dest)?.label

  async function run() {
    if (!dest || photoIds.length === 0 || !destLabel) return
    const ok = await confirmDialog.ask({
      title: `¿Mover ${photoIds.length} foto${photoIds.length === 1 ? '' : 's'}?`,
      description: `A "${destLabel}".`,
      confirmLabel: 'Mover fotos',
    })
    if (!ok) return
    setBusy(true)
    const [pidRaw, horarioStart] = dest.split('::')
    const point_id = pidRaw === UNASSIGNED ? null : pidRaw
    const update: Record<string, unknown> = { point_id }
    if (horarioStart) update.captured_at = new Date(`${eventDate}T${horarioStart}:00`).toISOString()
    const { error } = await supabase.from('photos').update(update).in('id', photoIds)
    setBusy(false)
    if (error) {
      push({ type: 'error', title: 'No se pudo mover', description: error.message })
      return
    }
    push({ type: 'success', title: `${photoIds.length} foto${photoIds.length === 1 ? '' : 's'} movida${photoIds.length === 1 ? '' : 's'}` })
    setDest('')
    onDone()
  }

  if (options.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FancySelect value={dest} onChange={setDest} options={options} placeholder="Mover a…" className="w-56" />
      <Button variant="secondary" size="sm" onClick={run} loading={busy} disabled={!dest}>
        Mover {photoIds.length} foto{photoIds.length === 1 ? '' : 's'}
      </Button>
    </div>
  )
}

function FeaturedUploadControl({ eventId, photographerId }: { eventId: string; photographerId: string }) {
  const { queue, usedSlots, remaining, enqueue, retry } = useFeaturedPhotosManager(eventId, photographerId)
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={remaining === 0}>
          Subir destacadas
        </Button>
        <span className="text-xs text-muted-foreground">{usedSlots} / {MAX_FEATURED} usadas</span>
      </div>
      <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => enqueue(e.target.files)} />
      {queue.length > 0 && (
        <div className="flex flex-col gap-1">
          {queue.map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
              {item.status === 'error' ? (
                <button onClick={() => retry(item)} className="font-semibold text-accent hover:underline">
                  Reintentar
                </button>
              ) : (
                <span className="text-muted-foreground">{Math.round(item.progress)}%</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface EventStorageManagerProps {
  eventId: string
  photographerId: string
  price: number
  watermarkPath: string | null
  eventDate: string
}

/** El mismo administrador de almacenamiento tipo carpetas de la pantalla de
 * Almacenamiento (`useStorageOverview`/`Tree.tsx`), acotado a ESTE evento y
 * embebido en el editor — reemplaza la cuadrícula de miniaturas de
 * `EventImagesManager` (esa queda intacta para el visor del evento, que no
 * cambia). Sin miniaturas a propósito (pedido explícito): vista de lista
 * con densidad configurable, para que el editor no se vuelva kilométrico
 * con cientos de fotos. */
export function EventStorageManager({ eventId, photographerId, price, watermarkPath, eventDate }: EventStorageManagerProps) {
  const { data, isLoading } = useEventStorageTree(eventId)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [columns, setColumns] = useState<1 | 2 | 3>(1)
  const [pageSize, setPageSize] = useState<10 | 50 | 100>(10)
  const [page, setPage] = useState(0)

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function select(key: string) {
    setSelectedKey(key)
    setSelectedIds(new Set())
    setPage(0)
  }

  const points = data?.points ?? []
  const node = findNode(selectedKey, points)

  if (isLoading) return <SkeletonRows count={3} />

  const nodePhotos =
    node?.kind === 'featured' ? data!.featured.photos : node?.kind === 'point' ? node.point.photos : node?.kind === 'horario' ? node.horario.photos : node?.kind === 'leftover' ? node.point.leftover!.photos : []
  const nodeStats = node?.kind === 'featured' ? data!.featured : node?.kind === 'point' ? node.point : node?.kind === 'horario' ? node.horario : node?.kind === 'leftover' ? node.point.leftover! : null
  const nodeRawIds = node?.kind === 'featured' ? data!.featured.rawPhotoIds : node?.kind === 'point' ? node.point.rawPhotoIds : node?.kind === 'horario' ? node.horario.rawPhotoIds : node?.kind === 'leftover' ? node.point.leftover!.rawPhotoIds : []
  const nodePhotoIds = nodePhotos.map((p) => p.id)
  const effectiveIds = selectedIds.size > 0 ? Array.from(selectedIds) : nodePhotoIds
  const effectiveLabel = selectedIds.size > 0 ? `${selectedIds.size} foto${selectedIds.size === 1 ? '' : 's'} seleccionada${selectedIds.size === 1 ? '' : 's'}` : 'todo este grupo'
  const effectiveRawIds = selectedIds.size > 0 ? nodeRawIds.filter((id) => selectedIds.has(id)) : nodeRawIds
  const effectiveStats =
    selectedIds.size > 0
      ? (() => {
          const sel = nodePhotos.filter((p) => selectedIds.has(p.id))
          const sold = sel.filter((p) => p.delivered_path)
          const bytesOf = (p: typeof sel[number]) => (p.preview_size_bytes ?? 0) + (p.raw_size_bytes ?? 0) + (p.delivered_size_bytes ?? 0)
          return {
            totalPhotos: sel.length,
            soldPhotos: sold.length,
            bytes: sel.reduce((s, p) => s + bytesOf(p), 0),
            soldBytes: sold.reduce((s, p) => s + bytesOf(p), 0),
            unsoldBytes: sel.filter((p) => !p.delivered_path).reduce((s, p) => s + bytesOf(p), 0),
          }
        })()
      : nodeStats

  const cleanupTarget: CleanupTarget =
    selectedIds.size > 0
      ? { photoIds: effectiveIds }
      : node?.kind === 'point' && node.point.id
        ? { eventId, pointId: node.point.id }
        : { photoIds: effectiveIds }

  const sourcePointId = node?.kind === 'point' ? node.point.id : node?.kind === 'horario' || node?.kind === 'leftover' ? node.point.id : null

  const listRows: PhotoListRow[] = nodePhotos.map((p) => ({ id: p.id, filename: p.original_filename, bytes: (p.preview_size_bytes ?? 0) + (p.raw_size_bytes ?? 0) + (p.delivered_size_bytes ?? 0), sold: !!p.delivered_path }))

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleAllSelected(ids: string[], selectAll: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) selectAll ? next.add(id) : next.delete(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex flex-col gap-0.5 rounded-3xl border border-border bg-card p-2 lg:w-[300px] lg:shrink-0">
        <TreeRow
          depth={0}
          icon="⭐"
          label="Destacadas"
          stats={`${data?.featured.totalPhotos ?? 0} · ${formatBytes(data?.featured.bytes ?? 0)}`}
          hasChildren={false}
          expanded={false}
          selected={selectedKey === 'featured'}
          onToggle={() => {}}
          onSelect={() => select('featured')}
        />
        {points.length === 0 && <p className="px-3 py-4 text-xs text-muted-foreground">Agrega puntos en la pestaña "Ruta" para poder subir fotos.</p>}
        {points.map((point) => {
          const pKey = pointKeyOf(point)
          const pOpen = expanded.has(pKey)
          const hasChildren = point.horarios.length > 0 || (point.leftover?.totalPhotos ?? 0) > 0
          return (
            <div key={pKey}>
              <TreeRow
                depth={0}
                icon="📂"
                label={point.label}
                stats={`${point.totalPhotos} · ${formatBytes(point.bytes)}`}
                hasChildren={hasChildren}
                expanded={pOpen}
                selected={selectedKey === pKey}
                onToggle={() => toggleExpand(pKey)}
                onSelect={() => select(pKey)}
              />
              <TreeChildren open={pOpen}>
                {point.horarios.map((h) => {
                  const hKey = `horario:${h.key}`
                  return (
                    <TreeRow
                      key={hKey}
                      depth={1}
                      icon="🕐"
                      label={`${h.start}–${h.end}`}
                      stats={`${h.totalPhotos} · ${formatBytes(h.bytes)}`}
                      hasChildren={false}
                      expanded={false}
                      selected={selectedKey === hKey}
                      onToggle={() => {}}
                      onSelect={() => select(hKey)}
                    />
                  )
                })}
                {point.leftover && point.leftover.totalPhotos > 0 && (
                  <TreeRow
                    depth={1}
                    icon="🕐"
                    label="Sin horario declarado"
                    stats={`${point.leftover.totalPhotos} · ${formatBytes(point.leftover.bytes)}`}
                    hasChildren={false}
                    expanded={false}
                    selected={selectedKey === leftoverKeyOf(point)}
                    onToggle={() => {}}
                    onSelect={() => select(leftoverKeyOf(point))}
                  />
                )}
              </TreeChildren>
            </div>
          )
        })}
      </div>

      <div className="flex-1">
        {!node || !nodeStats || !effectiveStats ? (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border py-16 text-center text-muted-foreground">
            <span className="text-3xl opacity-40">🗂️</span>
            <p className="text-sm font-medium">Selecciona Destacadas, un punto o un horario para administrar sus fotos</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-border bg-muted/30 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fotos</p>
                <p className="mt-1 text-lg font-bold">{nodeStats.totalPhotos}</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/30 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Espacio</p>
                <p className="mt-1 text-lg font-bold">{formatBytes(nodeStats.bytes)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/30 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Vendidas</p>
                <p className="mt-1 text-lg font-bold">{nodeStats.soldPhotos}</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/30 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">No vendidas</p>
                <p className="mt-1 text-lg font-bold">{nodeStats.totalPhotos - nodeStats.soldPhotos}</p>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {selectedIds.size > 0 ? `Acciones sobre ${effectiveLabel}` : 'Acciones sobre todo el grupo'}
              </p>
              <div className="flex flex-col gap-3">
                <CleanupControl target={cleanupTarget} scopeLabel={effectiveLabel} stats={effectiveStats} onDone={() => { setSelectedIds(new Set()); invalidateEventStorage(eventId) }} />
                {node.kind !== 'featured' && (
                  <MoveSelectedControl eventDate={eventDate} points={points} sourcePointId={sourcePointId} photoIds={effectiveIds} onDone={() => { setSelectedIds(new Set()); invalidateEventStorage(eventId) }} />
                )}
                <DownloadRawControl photoIds={effectiveIds} rawPhotoIds={effectiveRawIds} />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Subir fotos aquí</p>
              {node.kind === 'featured' ? (
                <FeaturedUploadControl eventId={eventId} photographerId={photographerId} />
              ) : (
                <PhotoUploadQueue
                  eventId={eventId}
                  pointId={node.point.id}
                  photographerId={photographerId}
                  price={price}
                  watermarkPath={watermarkPath}
                  manualSegments={node.kind === 'point' && node.point.manualSegments.length > 0 ? node.point.manualSegments : undefined}
                  eventDate={eventDate}
                  forcedCapturedAt={node.kind === 'horario' ? new Date(`${eventDate}T${node.horario.start}:00`).toISOString() : undefined}
                  onItemUploaded={() => invalidateEventStorage(eventId)}
                />
              )}
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fotos ({nodePhotos.length})</p>
              <PhotoListView
                photos={listRows}
                columns={columns}
                onColumnsChange={setColumns}
                pageSize={pageSize}
                onPageSizeChange={(n) => { setPageSize(n); setPage(0) }}
                page={page}
                onPageChange={setPage}
                selected={selectedIds}
                onToggle={toggleSelected}
                onToggleAll={toggleAllSelected}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
