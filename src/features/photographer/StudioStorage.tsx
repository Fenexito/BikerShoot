import { useState } from 'react'
import { Link } from 'react-router-dom'
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

function ActionButton({ label, description, busy, onClick }: { label: string; description: string; busy: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex flex-col gap-0.5 border border-border px-3 py-2 text-left transition-colors hover:border-accent hover:bg-accent/5 disabled:opacity-50"
    >
      <span className="font-studio-mono text-[10px] font-bold uppercase tracking-wider2">{busy ? 'Procesando…' : label}</span>
      <span className="text-[11px] text-muted-foreground">{description}</span>
    </button>
  )
}

function CleanupSoldButton({ eventId, pointId, clear, label, description }: { eventId: string; pointId?: string; clear: 'preview' | 'raw' | 'both'; label: string; description: string }) {
  const push = useToastStore((s) => s.push)
  const [busy, setBusy] = useState(false)

  async function run() {
    const what = clear === 'preview' ? 'la vista previa' : clear === 'raw' ? 'el respaldo crudo' : 'la vista previa y el respaldo crudo'
    const ok = await confirmDialog.ask({
      title: '¿Liberar espacio de fotos ya vendidas y entregadas?',
      description: `Se borrará ${what} de esas fotos. La entrega final del comprador NUNCA se toca.`,
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

  return <ActionButton label={label} description={description} busy={busy} onClick={run} />
}

function DeleteUnsoldButton({ pointId, eventId, label: scopeLabel }: { pointId?: string; eventId?: string; label: string }) {
  const push = useToastStore((s) => s.push)
  const [busy, setBusy] = useState(false)

  async function run() {
    const ok = await confirmDialog.ask({
      title: `¿Eliminar todas las fotos NO vendidas de "${scopeLabel}"?`,
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
    <ActionButton
      label="Eliminar no vendidas"
      description="Borra permanentemente las fotos que nadie ha comprado."
      busy={busy}
      onClick={run}
    />
  )
}

function ActionGroup({ title, eventId, pointId, scopeLabel }: { title: string; eventId: string; pointId?: string; scopeLabel: string }) {
  return (
    <div>
      <p className="mb-2 font-studio-mono text-[10px] uppercase tracking-wider2 text-muted-foreground">{title}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <DeleteUnsoldButton eventId={eventId} pointId={pointId} label={scopeLabel} />
        <CleanupSoldButton
          eventId={eventId}
          pointId={pointId}
          clear="preview"
          label="Liberar vista previa"
          description="De fotos ya vendidas. La entrega final no se toca."
        />
        <CleanupSoldButton
          eventId={eventId}
          pointId={pointId}
          clear="raw"
          label="Liberar respaldo crudo"
          description="De fotos ya vendidas. La entrega final no se toca."
        />
      </div>
    </div>
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
          <div className="mb-5 border-2 border-accent bg-accent/5 p-4">
            <p className="mb-3 font-studio-mono text-[10px] uppercase tracking-wider2 text-accent">
              Acciones de este evento — afecta los {event.points.length || 0} puntos y todo lo que no tenga punto asignado
            </p>
            <ActionGroup title="Acciones de este evento" eventId={event.id} scopeLabel={event.title} />
          </div>

          {event.points.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este evento no tiene puntos.</p>
          ) : (
            <div className="flex flex-col gap-0">
              <p className="mb-2 font-studio-mono text-[10px] uppercase tracking-wider2 text-muted-foreground">
                {event.points.length} puntos de este evento — cada uno se administra por separado
              </p>
              {event.points.map((pt, i) => (
                <div key={pt.id} className="flex gap-3 border-l-2 border-border pl-4">
                  <div className="flex flex-col items-center pt-1">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border font-studio-mono text-[10px] font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    {i < event.points.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                  </div>
                  <div className="mb-4 flex-1 border border-border bg-muted/30 p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{pt.label}</p>
                      <span className="font-studio-mono text-xs text-muted-foreground">
                        {formatBytes(pt.bytes)} · {pt.totalPhotos} fotos · {pt.soldPhotos} vendidas
                      </span>
                    </div>
                    <ActionGroup title="Acciones de este punto" eventId={event.id} pointId={pt.id} scopeLabel={pt.label} />
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
      <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">Almacenamiento</h1>
      <p className="mt-2 text-muted-foreground">Revisa qué eventos ocupan más espacio y libera lo que ya no necesitas.</p>

      {details?.storage_plan && (
        <div className="mt-6 border border-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground">
              <span>Uso total</span>
              <span className="text-foreground">
                {formatBytes(usageBytes)} de {details.storage_plan.gb_limit} GB
              </span>
              <span>· Plan {details.storage_plan.name}</span>
            </div>
            <Link to="/studio/planes">
              <Button variant="secondary" size="sm">
                {pct > 80 ? 'Mejorar plan →' : 'Ver planes'}
              </Button>
            </Link>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
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
