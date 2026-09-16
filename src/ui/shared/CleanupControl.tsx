import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../studio/Button'
import { useToastStore } from '../overlays/toastStore'
import { confirmDialog } from '../overlays/confirmStore'

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/** A quién apunta el borrado: `{eventId, pointId?}` para evento/punto reales
 * (un solo DELETE eficiente), o `{photoIds}` para una lista exacta de fotos
 * (horario, leftover, selección manual en una lista) — granularidades que
 * las funciones no entienden por `pointId`/`eventId`. */
export type CleanupTarget = { eventId: string; pointId?: string } | { photoIds: string[] }

function CleanupCategoryButton({
  kind,
  target,
  scopeLabel,
  photos,
  bytes,
  onDone,
}: {
  kind: 'unsold' | 'sold'
  target: CleanupTarget
  scopeLabel: string
  photos: number
  bytes: number
  onDone?: () => void
}) {
  const push = useToastStore((s) => s.push)
  const [busy, setBusy] = useState(false)

  async function run() {
    const ok = await confirmDialog.ask({
      title: `¿Liberar ${photos} foto${photos === 1 ? '' : 's'} (${formatBytes(bytes)})?`,
      description:
        kind === 'unsold'
          ? `Borra permanentemente las fotos de "${scopeLabel}" que nadie ha comprado. No se puede deshacer.`
          : `Borra el preview y el respaldo crudo de las fotos ya vendidas de "${scopeLabel}". La entrega final del comprador NUNCA se toca.`,
      confirmLabel: 'Liberar espacio',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      let deleted = 0
      let bytesFreed = 0
      if (kind === 'unsold') {
        const { data, error } = await supabase.functions.invoke('r2-delete-point-photos', { body: target })
        if (error) throw new Error(error.message)
        deleted = data.deleted as number
      } else {
        const { data, error } = await supabase.functions.invoke('r2-cleanup-sold-photos', { body: { ...target, clear: 'both' } })
        if (error) throw new Error(error.message)
        deleted = data.cleaned as number
        bytesFreed = data.bytesFreed as number
      }
      push({
        type: 'success',
        title: `${deleted} foto${deleted === 1 ? '' : 's'} liberada${deleted === 1 ? '' : 's'}`,
        description: bytesFreed > 0 ? `${formatBytes(bytesFreed)} liberados` : undefined,
      })
      onDone?.()
    } catch (err) {
      push({ type: 'error', title: 'No se pudo liberar espacio', description: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={run} loading={busy} disabled={photos === 0}>
      Liberar {photos} {kind === 'unsold' ? 'no vendida' : 'vendida'}{photos === 1 ? '' : 's'} · {formatBytes(bytes)}
    </Button>
  )
}

/** Dos botones directos (no vendidas / vendidas), cada uno con su propia
 * cantidad y bytes ya visibles — sin desplegable previo. Compartido por la
 * pantalla de Almacenamiento y por el administrador embebido en el editor
 * de evento, misma acción exacta en los dos lugares. */
export function CleanupControl({
  target,
  scopeLabel,
  stats,
  onDone,
}: {
  target: CleanupTarget
  scopeLabel: string
  stats: { totalPhotos: number; soldPhotos: number; bytes: number; soldBytes: number; unsoldBytes: number }
  onDone?: () => void
}) {
  const unsoldPhotos = stats.totalPhotos - stats.soldPhotos
  return (
    <div className="flex flex-wrap items-center gap-3">
      <CleanupCategoryButton kind="unsold" target={target} scopeLabel={scopeLabel} photos={unsoldPhotos} bytes={stats.unsoldBytes} onDone={onDone} />
      <CleanupCategoryButton kind="sold" target={target} scopeLabel={scopeLabel} photos={stats.soldPhotos} bytes={stats.soldBytes} onDone={onDone} />
    </div>
  )
}
