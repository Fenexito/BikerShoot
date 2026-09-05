import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePhotographerDetails, usePhotographerUsageBytes } from './usePhotographerDetails'
import { useStorageOverview, type EventStorage } from './useStorageOverview'
import { queryClient } from '../../lib/queryClient'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/studio/Button'
import { FancySelect } from '../../ui/shared/FancySelect'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { useToastStore } from '../../ui/overlays/toastStore'
import { confirmDialog } from '../../ui/overlays/confirmStore'
import { SkeletonRows } from '../../ui/shared/Skeleton'
import { cn } from '../../lib/cn'

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

type SortMode = 'oldest' | 'newest' | 'biggest'
type CleanupScope = 'unsold' | 'sold' | 'all'

const SCOPE_OPTIONS = [
  { value: 'unsold', label: 'No vendidas' },
  { value: 'sold', label: 'Vendidas' },
  { value: 'all', label: 'Todas' },
]

/** Un solo control para liberar espacio, en vez de 3 botones confusos.
 * "No vendidas" borra por completo (nunca se vendieron, nada que proteger).
 * "Vendidas" borra el preview + respaldo crudo pero JAMÁS la entrega final
 * — el biker que ya compró esa foto conserva acceso para siempre. "Todas"
 * aplica ambas cosas de una vez. */
function CleanupControl({ eventId, pointId, scopeLabel }: { eventId: string; pointId?: string; scopeLabel: string }) {
  const push = useToastStore((s) => s.push)
  const [scope, setScope] = useState<CleanupScope>('unsold')
  const [busy, setBusy] = useState(false)

  async function deleteUnsold() {
    const { data, error } = await supabase.functions.invoke('r2-delete-point-photos', { body: pointId ? { pointId } : { eventId } })
    if (error) throw new Error(error.message)
    return { deleted: data.deleted as number, bytesFreed: 0 }
  }

  async function cleanupSold() {
    const { data, error } = await supabase.functions.invoke('r2-cleanup-sold-photos', { body: { eventId, pointId, clear: 'both' } })
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
      title: '¿Liberar espacio?',
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
      queryClient.invalidateQueries({ queryKey: ['storage-overview'] })
      queryClient.invalidateQueries({ queryKey: ['photographer-usage-bytes'] })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo liberar espacio', description: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FancySelect value={scope} onChange={(v) => setScope(v as CleanupScope)} options={SCOPE_OPTIONS} clearable={false} className="w-40" />
      <Button variant="secondary" size="sm" onClick={run} loading={busy}>
        Liberar espacio
      </Button>
    </div>
  )
}

function EventDetail({ event, onBack }: { event: EventStorage; onBack: () => void }) {
  return (
    <div>
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        ← Todos los eventos
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{event.title}</h2>
          <p className="text-sm text-muted-foreground">
            {new Date(event.eventDate).toLocaleDateString('es-GT')} · {event.totalPhotos} fotos · {event.soldPhotos} vendidas · {formatBytes(event.bytes)}
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-accent/30 bg-accent/5 p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-accent">
          Acciones de todo el evento — afecta los {event.points.length || 0} puntos y lo que no tenga punto asignado
        </p>
        <CleanupControl eventId={event.id} scopeLabel={event.title} />
      </div>

      {event.points.length === 0 ? (
        <p className="text-sm text-muted-foreground">Este evento no tiene puntos.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {event.points.length} puntos — cada uno se administra por separado
          </p>
          {event.points.map((pt) => (
            <div key={pt.id} className="rounded-2xl border border-border bg-muted/30 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{pt.label}</p>
                <span className="text-xs text-muted-foreground">
                  {formatBytes(pt.bytes)} · {pt.totalPhotos} fotos · {pt.soldPhotos} vendidas
                </span>
              </div>
              <CleanupControl eventId={event.id} pointId={pt.id} scopeLabel={pt.label} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EventCard({ event, onOpen }: { event: EventStorage; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 text-left transition-all hover:border-accent/40 hover:shadow-sm"
    >
      <div className="min-w-0">
        <p className="truncate font-semibold">{event.title}</p>
        <p className="text-xs text-muted-foreground">{new Date(event.eventDate).toLocaleDateString('es-GT')}</p>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="font-bold">{formatBytes(event.bytes)}</span>
        <span className="text-xs text-muted-foreground">{event.totalPhotos} fotos · {event.soldPhotos} vendidas</span>
      </div>
    </button>
  )
}

export function StudioStorage() {
  const { user } = useAuth()
  const { data: details } = usePhotographerDetails(user?.id)
  const { data: usageBytes = 0 } = usePhotographerUsageBytes(user?.id)
  const { data: events, isLoading } = useStorageOverview(user?.id)
  const [sort, setSort] = useState<SortMode>('oldest')
  const [openEventId, setOpenEventId] = useState<string | null>(null)

  const sorted = [...(events ?? [])].sort((a, b) => {
    if (sort === 'oldest') return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    if (sort === 'newest') return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
    return b.bytes - a.bytes
  })

  const openEvent = sorted.find((e) => e.id === openEventId)

  const limitBytes = details?.storage_plan ? details.storage_plan.gb_limit * 1024 * 1024 * 1024 : 0
  const pct = limitBytes > 0 ? Math.min(100, (usageBytes / limitBytes) * 100) : 0

  return (
    <div className={STUDIO_PAGE_WIDE}>
      <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">Almacenamiento</h1>
      <p className="mt-2 text-muted-foreground">Revisa qué eventos ocupan más espacio y libera lo que ya no necesitas.</p>

      {details?.storage_plan && (
        <div className="mt-6 rounded-3xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span>Uso total</span>
              <span className="font-semibold text-foreground">
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
            <div className={cn('h-full rounded-full transition-all', pct > 90 ? 'bg-red-500' : 'bg-accent')} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {openEvent ? (
        <div className="mt-8">
          <EventDetail event={openEvent} onBack={() => setOpenEventId(null)} />
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight">Tus eventos</h2>
            <div className="flex gap-1 rounded-full bg-muted p-1">
              {(['oldest', 'newest', 'biggest'] as SortMode[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    sort === s ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {s === 'oldest' ? 'Más antiguos' : s === 'newest' ? 'Más recientes' : 'Más pesados'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading && <SkeletonRows count={3} />}
            {!isLoading && sorted.length === 0 && (
              <div className="col-span-full flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-16 text-center">
                <span className="text-4xl opacity-40">💾</span>
                <p className="font-semibold">Todavía no tienes eventos</p>
              </div>
            )}
            {sorted.map((event) => (
              <EventCard key={event.id} event={event} onOpen={() => setOpenEventId(event.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
