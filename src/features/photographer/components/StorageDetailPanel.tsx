import { useState, type ReactNode } from 'react'
import { supabase } from '../../../lib/supabase'
import { queryClient } from '../../../lib/queryClient'
import { useEvent } from '../useMyEvents'
import type { EventStorage, PointStorage, HorarioStorage } from '../useStorageOverview'
import { Button } from '../../../ui/studio/Button'
import { FancySelect } from '../../../ui/shared/FancySelect'
import { PhotoUploadQueue } from './PhotoUploadQueue'
import { useToastStore } from '../../../ui/overlays/toastStore'
import { confirmDialog } from '../../../ui/overlays/confirmStore'

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export type StorageNode =
  | { kind: 'event'; event: EventStorage }
  | { kind: 'point'; event: EventStorage; point: PointStorage }
  | { kind: 'horario'; event: EventStorage; point: PointStorage; horario: HorarioStorage }
  | { kind: 'leftover'; event: EventStorage; point: PointStorage }

function nodeStats(node: StorageNode) {
  if (node.kind === 'event') return node.event
  if (node.kind === 'point') return node.point
  if (node.kind === 'horario') return node.horario
  return node.point.leftover!
}

function nodePhotoIds(node: StorageNode) {
  if (node.kind === 'event') return node.event.photoIds
  if (node.kind === 'point') return node.point.photoIds
  if (node.kind === 'horario') return node.horario.photoIds
  return node.point.leftover!.photoIds
}

function nodeRawPhotoIds(node: StorageNode) {
  if (node.kind === 'event') return node.event.rawPhotoIds
  if (node.kind === 'point') return node.point.rawPhotoIds
  if (node.kind === 'horario') return node.horario.rawPhotoIds
  return node.point.leftover!.rawPhotoIds
}

function breadcrumb(node: StorageNode) {
  const parts = [node.event.title]
  if (node.kind !== 'event') parts.push(node.point.label)
  if (node.kind === 'horario') parts.push(`${node.horario.start}–${node.horario.end}`)
  if (node.kind === 'leftover') parts.push('Sin horario declarado')
  return parts.join(' › ')
}

function invalidateStorage() {
  queryClient.invalidateQueries({ queryKey: ['storage-overview'] })
  queryClient.invalidateQueries({ queryKey: ['photographer-usage-bytes'] })
  queryClient.invalidateQueries({ queryKey: ['event-photos-detailed'] })
  queryClient.invalidateQueries({ queryKey: ['my-events'] })
}

type CleanupScope = 'unsold' | 'sold' | 'all'
const SCOPE_OPTIONS = [
  { value: 'unsold', label: 'No vendidas' },
  { value: 'sold', label: 'Vendidas' },
  { value: 'all', label: 'Todas' },
]

/** A quién apunta el borrado: `{eventId, pointId?}` para evento/punto reales
 * (la mayoría de las fotos, en un solo DELETE eficiente), o `{photoIds}`
 * para granularidades más finas (horario, leftover de un punto, o el
 * bucket "sin punto" de un evento) que las funciones no entienden por
 * `pointId`/`eventId`. */
type CleanupTarget = { eventId: string; pointId?: string } | { photoIds: string[] }

function CleanupControl({ target, scopeLabel, stats }: { target: CleanupTarget; scopeLabel: string; stats: { totalPhotos: number; soldPhotos: number; bytes: number; soldBytes: number; unsoldBytes: number } }) {
  const push = useToastStore((s) => s.push)
  const [scope, setScope] = useState<CleanupScope>('unsold')
  const [busy, setBusy] = useState(false)

  const unsoldPhotos = stats.totalPhotos - stats.soldPhotos
  const scopeInfo: Record<CleanupScope, { photos: number; bytes: number }> = {
    unsold: { photos: unsoldPhotos, bytes: stats.unsoldBytes },
    sold: { photos: stats.soldPhotos, bytes: stats.soldBytes },
    all: { photos: stats.totalPhotos, bytes: stats.bytes },
  }
  const info = scopeInfo[scope]

  async function deleteUnsold() {
    const { data, error } = await supabase.functions.invoke('r2-delete-point-photos', { body: target })
    if (error) throw new Error(error.message)
    return { deleted: data.deleted as number }
  }

  async function cleanupSold() {
    const { data, error } = await supabase.functions.invoke('r2-cleanup-sold-photos', { body: { ...target, clear: 'both' } })
    if (error) throw new Error(error.message)
    return { deleted: data.cleaned as number, bytesFreed: data.bytesFreed as number }
  }

  async function run() {
    const descriptions: Record<CleanupScope, string> = {
      unsold: `Borra permanentemente las fotos de "${scopeLabel}" que nadie ha comprado.`,
      sold: `Borra el preview y el respaldo crudo de las fotos ya vendidas de "${scopeLabel}". La entrega final del comprador NUNCA se toca.`,
      all: `Borra las fotos no vendidas de "${scopeLabel}" por completo, y libera el preview/respaldo de las vendidas. La entrega final del comprador NUNCA se toca.`,
    }
    const ok = await confirmDialog.ask({
      title: `¿Liberar ${info.photos} foto${info.photos === 1 ? '' : 's'} (${formatBytes(info.bytes)})?`,
      description: descriptions[scope],
      confirmLabel: 'Liberar espacio',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      let deleted = 0
      let bytesFreed = 0
      if (scope === 'unsold' || scope === 'all') {
        const r = await deleteUnsold()
        deleted += r.deleted
      }
      if (scope === 'sold' || scope === 'all') {
        const r = await cleanupSold()
        deleted += r.deleted
        bytesFreed += r.bytesFreed
      }
      push({
        type: 'success',
        title: `${deleted} foto${deleted === 1 ? '' : 's'} liberada${deleted === 1 ? '' : 's'}`,
        description: bytesFreed > 0 ? `${formatBytes(bytesFreed)} liberados` : undefined,
      })
      invalidateStorage()
    } catch (err) {
      push({ type: 'error', title: 'No se pudo liberar espacio', description: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FancySelect value={scope} onChange={(v) => setScope(v as CleanupScope)} options={SCOPE_OPTIONS} clearable={false} className="w-40" />
      <p className="text-xs text-muted-foreground">
        Esto liberaría <span className="font-semibold text-foreground">{info.photos} foto{info.photos === 1 ? '' : 's'}</span> ·{' '}
        <span className="font-semibold text-foreground">{formatBytes(info.bytes)}</span>
      </p>
      <Button variant="secondary" size="sm" onClick={run} loading={busy} disabled={info.photos === 0}>
        Liberar espacio
      </Button>
    </div>
  )
}

const UNASSIGNED = '__unassigned__'

/** Mueve TODAS las fotos de este nodo a otro punto del mismo evento (o a
 * "sin punto asignado") — mismo patrón que `bulkMoveTo` en
 * `EventImagesManager.tsx` (update directo de `point_id`, sin backend
 * nuevo), aplicado aquí a la lista exacta de `photoIds` del nodo en vez de
 * a una selección manual. Restringido al mismo evento: mover entre eventos
 * rompería el precio y la ruta asociados a cada uno. */
function MoveControl({ event, sourcePointId, photoIds }: { event: EventStorage; sourcePointId: string | null; photoIds: string[] }) {
  const push = useToastStore((s) => s.push)
  const [dest, setDest] = useState('')
  const [busy, setBusy] = useState(false)

  const options = [
    ...event.points.filter((p) => p.id !== null && p.id !== sourcePointId).map((p) => ({ value: p.id as string, label: p.label })),
    ...(sourcePointId !== null ? [{ value: UNASSIGNED, label: 'Sin punto asignado' }] : []),
  ]

  async function run() {
    if (!dest || photoIds.length === 0) return
    setBusy(true)
    const { error } = await supabase
      .from('photos')
      .update({ point_id: dest === UNASSIGNED ? null : dest })
      .in('id', photoIds)
    setBusy(false)
    if (error) {
      push({ type: 'error', title: 'No se pudo mover', description: error.message })
      return
    }
    push({ type: 'success', title: `${photoIds.length} foto${photoIds.length === 1 ? '' : 's'} movida${photoIds.length === 1 ? '' : 's'}` })
    setDest('')
    invalidateStorage()
  }

  if (options.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FancySelect value={dest} onChange={setDest} options={options} placeholder="Mover a…" className="w-48" />
      <Button variant="secondary" size="sm" onClick={run} loading={busy} disabled={!dest || photoIds.length === 0}>
        Mover fotos
      </Button>
    </div>
  )
}

/** Descarga el respaldo crudo (si existe) de cada foto del nodo, una URL
 * firmada a la vez vía `r2-raw-download-url` — la única función que ya
 * existe para esto. Sin zip server-side (no hay infraestructura para eso
 * hoy): dispara descargas normales del navegador, espaciadas para no
 * chocar con el bloqueo de pop-ups. */
function DownloadRawControl({ photoIds, rawPhotoIds }: { photoIds: string[]; rawPhotoIds: string[] }) {
  const push = useToastStore((s) => s.push)
  const [busy, setBusy] = useState(false)
  const skipped = photoIds.length - rawPhotoIds.length

  async function run() {
    if (rawPhotoIds.length === 0) return
    setBusy(true)
    let ok = 0
    for (const photoId of rawPhotoIds) {
      try {
        const { data, error } = await supabase.functions.invoke('r2-raw-download-url', { body: { photoId } })
        if (error || !data?.downloadUrl) continue
        const a = document.createElement('a')
        a.href = data.downloadUrl
        a.download = ''
        document.body.appendChild(a)
        a.click()
        a.remove()
        ok++
        await new Promise((r) => setTimeout(r, 350))
      } catch {
        // sigue con la siguiente
      }
    }
    setBusy(false)
    push({ type: ok > 0 ? 'success' : 'error', title: ok > 0 ? `${ok} descarga${ok === 1 ? '' : 's'} iniciada${ok === 1 ? '' : 's'}` : 'No se pudo descargar nada' })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-xs text-muted-foreground">
        {rawPhotoIds.length} foto{rawPhotoIds.length === 1 ? '' : 's'} con respaldo crudo
        {skipped > 0 && ` · ${skipped} sin respaldo (se omiten)`}
      </p>
      <Button variant="secondary" size="sm" onClick={run} loading={busy} disabled={rawPhotoIds.length === 0}>
        Descargar respaldos
      </Button>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-border pt-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

export function StorageDetailPanel({ node, photographerId }: { node: StorageNode; photographerId: string }) {
  const { data: eventDetail } = useEvent(node.event.id)
  const stats = nodeStats(node)
  const photoIds = nodePhotoIds(node)
  const rawPhotoIds = nodeRawPhotoIds(node)

  const cleanupTarget: CleanupTarget =
    node.kind === 'event'
      ? { eventId: node.event.id }
      : node.kind === 'point' && node.point.id
        ? { eventId: node.event.id, pointId: node.point.id }
        : { photoIds }

  const sourcePointId = node.kind === 'event' ? null : node.point.id
  const canMove = node.kind !== 'event'

  const price = eventDetail?.price_per_photo ?? 0
  const watermarkPath = eventDetail?.watermark_path ?? null

  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-5">
      <div>
        <p className="text-xs font-medium text-muted-foreground">{breadcrumb(node)}</p>
        <h3 className="mt-1 text-xl font-bold tracking-tight">
          {node.kind === 'event' ? node.event.title : node.kind === 'point' ? node.point.label : node.kind === 'horario' ? `${node.horario.start}–${node.horario.end}` : 'Sin horario declarado'}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Fotos" value={String(stats.totalPhotos)} />
        <StatTile label="Espacio" value={formatBytes(stats.bytes)} />
        <StatTile label="Vendidas" value={String(stats.soldPhotos)} />
        <StatTile label="No vendidas" value={String(stats.totalPhotos - stats.soldPhotos)} />
      </div>

      <Section title="Liberar espacio">
        <CleanupControl target={cleanupTarget} scopeLabel={breadcrumb(node)} stats={stats} />
      </Section>

      {canMove && (
        <Section title="Mover fotos">
          <MoveControl event={node.event} sourcePointId={sourcePointId} photoIds={photoIds} />
        </Section>
      )}

      <Section title="Descargar">
        <DownloadRawControl photoIds={photoIds} rawPhotoIds={rawPhotoIds} />
      </Section>

      {node.kind !== 'leftover' && (
        <Section title="Subir fotos aquí">
          <PhotoUploadQueue
            eventId={node.event.id}
            pointId={node.kind === 'event' ? null : node.point.id}
            photographerId={photographerId}
            price={price}
            watermarkPath={watermarkPath}
            manualSegments={node.kind === 'point' && node.point.manualSegments.length > 0 ? node.point.manualSegments : undefined}
            eventDate={node.event.eventDate}
            forcedCapturedAt={
              node.kind === 'horario' ? new Date(`${node.event.eventDate}T${node.horario.start}:00`).toISOString() : undefined
            }
            onItemUploaded={invalidateStorage}
          />
        </Section>
      )}
    </div>
  )
}
