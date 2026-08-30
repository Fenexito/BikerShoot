import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { usePhotographerDetails, usePhotographerUsageBytes } from './usePhotographerDetails'
import { useStorageOverview, type EventStorage } from './useStorageOverview'
import { queryClient } from '../../lib/queryClient'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/studio/Button'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { useToastStore } from '../../ui/overlays/toastStore'
import { confirmDialog } from '../../ui/overlays/confirmStore'
import { cn } from '../../lib/cn'

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

type SortMode = 'oldest' | 'newest' | 'biggest'

function CleanupSoldButton({ eventId, pointId }: { eventId: string; pointId?: string }) {
  const push = useToastStore((s) => s.push)
  const [busy, setBusy] = useState(false)

  async function run(clear: 'preview' | 'raw' | 'both') {
    const label = clear === 'preview' ? 'la vista previa' : clear === 'raw' ? 'el respaldo crudo' : 'la vista previa y el respaldo crudo'
    const ok = await confirmDialog.ask({
      title: '¿Liberar espacio de fotos ya vendidas y entregadas?',
      description: `Se borrará ${label} de esas fotos. La entrega final del comprador NUNCA se toca.`,
      confirmLabel: 'Liberar espacio',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('r2-cleanup-sold-photos', { body: { eventId, pointId, clear } })
      if (error) throw new Error(error.message)
      push({ type: 'success', title: `${data.cleaned} fotos limpiadas`, description: `${formatBytes(data.bytesFreed)} liberados` })
      queryClient.invalidateQueries({ queryKey: ['storage-overview'] })
      queryClient.invalidateQueries({ queryKey: ['photographer-usage-bytes'] })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo liberar espacio', description: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="ghost" disabled={busy} onClick={() => run('preview')}>Liberar previews vendidas</Button>
      <Button variant="ghost" disabled={busy} onClick={() => run('raw')}>Liberar respaldos vendidos</Button>
      <Button variant="ghost" disabled={busy} onClick={() => run('both')}>Liberar ambos (vendidas)</Button>
    </div>
  )
}

function DeleteUnsoldButton({ pointId, eventId, label }: { pointId?: string; eventId?: string; label: string }) {
  const push = useToastStore((s) => s.push)
  const [busy, setBusy] = useState(false)

  async function run() {
    const ok = await confirmDialog.ask({
      title: `¿Eliminar todas las fotos NO vendidas de "${label}"?`,
      description: 'Esta acción borra los archivos de forma permanente. Las fotos ya vendidas se conservan intactas.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('r2-delete-point-photos', { body: pointId ? { pointId } : { eventId } })
      if (error) throw new Error(error.message)
      push({
        type: 'success',
        title: `${data.deleted} fotos eliminadas`,
        description: data.skippedSold > 0 ? `${data.skippedSold} ya vendidas se conservaron` : undefined,
      })
      queryClient.invalidateQueries({ queryKey: ['storage-overview'] })
      queryClient.invalidateQueries({ queryKey: ['photographer-usage-bytes'] })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo eliminar', description: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="ghost" disabled={busy} onClick={run}>
      {pointId ? 'Eliminar fotos no vendidas de este punto' : 'Eliminar fotos no vendidas de este evento'}
    </Button>
  )
}

function EventRow({ event }: { event: EventStorage }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-border">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left">
        <div className="min-w-0">
          <p className="truncate font-semibold">{event.title}</p>
          <p className="font-studio-mono text-[10px] uppercase tracking-wider2 text-muted-foreground">
            {new Date(event.eventDate).toLocaleDateString('es-GT')} · {event.totalPhotos} fotos · {event.soldPhotos} vendidas
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <span className="font-studio-mono text-sm">{formatBytes(event.bytes)}</span>
          <span className="text-muted-foreground">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <p className="font-studio-mono text-[10px] uppercase tracking-wider2 text-muted-foreground">Acciones sobre todo el evento</p>
            <div className="flex flex-wrap gap-2">
              <DeleteUnsoldButton eventId={event.id} label={event.title} />
              <CleanupSoldButton eventId={event.id} />
            </div>
          </div>

          {event.points.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este evento no tiene puntos.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {event.points.map((pt) => (
                <div key={pt.id} className="flex flex-col gap-2 border border-border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{pt.label}</p>
                    <span className="font-studio-mono text-xs text-muted-foreground">
                      {formatBytes(pt.bytes)} · {pt.totalPhotos} fotos · {pt.soldPhotos} vendidas
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <DeleteUnsoldButton pointId={pt.id} label={pt.label} eventId={event.id} />
                    <CleanupSoldButton eventId={event.id} pointId={pt.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function StudioStorage() {
  const { user } = useAuth()
  const { data: details } = usePhotographerDetails(user?.id)
  const { data: usageBytes = 0 } = usePhotographerUsageBytes(user?.id)
  const { data: events, isLoading } = useStorageOverview(user?.id)
  const [sort, setSort] = useState<SortMode>('oldest')

  const sorted = [...(events ?? [])].sort((a, b) => {
    if (sort === 'oldest') return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    if (sort === 'newest') return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
    return b.bytes - a.bytes
  })

  const limitBytes = details?.storage_plan ? details.storage_plan.gb_limit * 1024 * 1024 * 1024 : 0
  const pct = limitBytes > 0 ? Math.min(100, (usageBytes / limitBytes) * 100) : 0

  return (
    <div className={STUDIO_PAGE_WIDE}>
      <h1 className="font-studio text-2xl font-bold tracking-tight2">Administrar almacenamiento</h1>
      <p className="mt-1 text-muted-foreground">Revisa qué eventos ocupan más espacio y libera lo que ya no necesitas.</p>

      {details?.storage_plan && (
        <div className="mt-6 border border-border p-5">
          <div className="flex items-center justify-between font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground">
            <span>Uso total</span>
            <span>
              {formatBytes(usageBytes)} de {details.storage_plan.gb_limit} GB
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full transition-all', pct > 90 ? 'bg-red-500' : 'bg-accent')} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-studio text-lg font-bold tracking-tight2">Tus eventos</h2>
        <div className="flex border border-border">
          {(['oldest', 'newest', 'biggest'] as SortMode[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={cn('px-2 py-1 text-[10px] uppercase tracking-wider2', sort === s ? 'bg-foreground text-background' : 'text-muted-foreground')}
            >
              {s === 'oldest' ? 'Más antiguos' : s === 'newest' ? 'Más recientes' : 'Más pesados'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {isLoading && <p className="text-muted-foreground">Cargando…</p>}
        {!isLoading && sorted.length === 0 && <p className="text-muted-foreground">Todavía no tienes eventos.</p>}
        {sorted.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </div>
    </div>
  )
}
