import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePhotographerDetails, usePhotographerUsageBytes } from './usePhotographerDetails'
import { useStorageOverview, type EventStorage, type PointStorage } from './useStorageOverview'
import { Button } from '../../ui/studio/Button'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { SkeletonRows } from '../../ui/shared/Skeleton'
import { TreeRow, TreeChildren } from '../../ui/shared/Tree'
import { StorageDetailPanel, type StorageNode } from './components/StorageDetailPanel'
import { cn } from '../../lib/cn'

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

type SortMode = 'oldest' | 'newest' | 'biggest'

const eventKeyOf = (event: EventStorage) => `event:${event.id}`
const pointKeyOf = (event: EventStorage, point: PointStorage) => `point:${event.id}:${point.id ?? 'unassigned'}`
const horarioKeyOf = (key: string) => `horario:${key}`
const leftoverKeyOf = (event: EventStorage, point: PointStorage) => `leftover:${event.id}:${point.id ?? 'unassigned'}`

/** Reconstruye el nodo seleccionado a partir de su clave y de los datos
 * FRESCOS del árbol — nunca se guarda el nodo en sí en el estado, para que
 * el panel de detalle siempre refleje el estado real después de una
 * acción (mover/eliminar/subir invalida `storage-overview` y esto vuelve a
 * resolver la misma clave contra los datos ya actualizados). Si la clave
 * ya no resuelve (ej. se vació y desapareció un bucket "sin horario"),
 * devuelve `null` y el panel cae al estado vacío. */
function findNode(key: string | null, events: EventStorage[]): StorageNode | null {
  if (!key) return null
  const [kind, ...rest] = key.split(':')

  if (kind === 'event') {
    const event = events.find((e) => e.id === rest.join(':'))
    return event ? { kind: 'event', event } : null
  }

  if (kind === 'point') {
    const [eventId, pointIdRaw] = rest
    const event = events.find((e) => e.id === eventId)
    if (!event) return null
    const point = event.points.find((p) => (p.id ?? 'unassigned') === pointIdRaw)
    return point ? { kind: 'point', event, point } : null
  }

  if (kind === 'horario') {
    const horarioKey = rest.join(':')
    for (const event of events) {
      for (const point of event.points) {
        const horario = point.horarios.find((h) => h.key === horarioKey)
        if (horario) return { kind: 'horario', event, point, horario }
      }
    }
    return null
  }

  if (kind === 'leftover') {
    const [eventId, pointIdRaw] = rest
    const event = events.find((e) => e.id === eventId)
    if (!event) return null
    const point = event.points.find((p) => (p.id ?? 'unassigned') === pointIdRaw)
    return point?.leftover && point.leftover.totalPhotos > 0 ? { kind: 'leftover', event, point } : null
  }

  return null
}

export function StudioStorage() {
  const { user } = useAuth()
  const { data: details } = usePhotographerDetails(user?.id)
  const { data: usageBytes = 0 } = usePhotographerUsageBytes(user?.id)
  const { data: events, isLoading } = useStorageOverview(user?.id)
  const [sort, setSort] = useState<SortMode>('oldest')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function select(key: string) {
    setSelectedKey(key)
    // Solo hace falta desplazar la vista en el layout apilado de móvil — en
    // escritorio el panel ya vive al lado del árbol (`lg:sticky`), y forzar
    // el scroll ahí de todos modos movía la página entera bajo el cursor,
    // lo que podía desalinear el siguiente clic justo después de elegir.
    if (window.innerWidth < 1024) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }

  const sorted = [...(events ?? [])].sort((a, b) => {
    if (sort === 'oldest') return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    if (sort === 'newest') return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
    return b.bytes - a.bytes
  })

  const selectedNode = findNode(selectedKey, sorted)
  const limitBytes = details?.storage_plan ? details.storage_plan.gb_limit * 1024 * 1024 * 1024 : 0
  const pct = limitBytes > 0 ? Math.min(100, (usageBytes / limitBytes) * 100) : 0

  return (
    <div className={STUDIO_PAGE_WIDE}>
      <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">Almacenamiento</h1>
      <p className="mt-2 text-muted-foreground">
        Explora tu almacenamiento como carpetas — evento, punto y horario — y administra cada nivel por separado.
      </p>

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

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">Tus eventos</h2>
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {(['oldest', 'newest', 'biggest'] as SortMode[]).map((s) => (
            <button
              key={s}
              data-no-ripple
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

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-0.5 rounded-3xl border border-border bg-card p-2 lg:w-[380px] lg:shrink-0 lg:max-h-[70vh] lg:overflow-y-auto">
          {isLoading && <SkeletonRows count={3} />}
          {!isLoading && sorted.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="text-4xl opacity-40">💾</span>
              <p className="font-semibold">Todavía no tienes eventos</p>
            </div>
          )}

          {sorted.map((event) => {
            const eKey = eventKeyOf(event)
            const eOpen = expanded.has(eKey)
            return (
              <div key={event.id}>
                <TreeRow
                  depth={0}
                  icon="📁"
                  label={event.title}
                  stats={`${event.totalPhotos} · ${formatBytes(event.bytes)}`}
                  hasChildren={event.points.length > 0}
                  expanded={eOpen}
                  selected={selectedKey === eKey}
                  onToggle={() => toggle(eKey)}
                  onSelect={() => select(eKey)}
                />
                <TreeChildren open={eOpen}>
                  {event.points.map((point) => {
                    const pKey = pointKeyOf(event, point)
                    const pOpen = expanded.has(pKey)
                    const hasHorarios = point.horarios.length > 0 || (point.leftover?.totalPhotos ?? 0) > 0
                    return (
                      <div key={pKey}>
                        <TreeRow
                          depth={1}
                          icon="📂"
                          label={point.label}
                          stats={`${point.totalPhotos} · ${formatBytes(point.bytes)}`}
                          hasChildren={hasHorarios}
                          expanded={pOpen}
                          selected={selectedKey === pKey}
                          onToggle={() => toggle(pKey)}
                          onSelect={() => select(pKey)}
                        />
                        <TreeChildren open={pOpen}>
                          {point.horarios.map((horario) => {
                            const hKey = horarioKeyOf(horario.key)
                            return (
                              <TreeRow
                                key={hKey}
                                depth={2}
                                icon="🕐"
                                label={`${horario.start}–${horario.end}`}
                                stats={`${horario.totalPhotos} · ${formatBytes(horario.bytes)}`}
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
                              key={leftoverKeyOf(event, point)}
                              depth={2}
                              icon="🕐"
                              label="Sin horario declarado"
                              stats={`${point.leftover.totalPhotos} · ${formatBytes(point.leftover.bytes)}`}
                              hasChildren={false}
                              expanded={false}
                              selected={selectedKey === leftoverKeyOf(event, point)}
                              onToggle={() => {}}
                              onSelect={() => select(leftoverKeyOf(event, point))}
                            />
                          )}
                        </TreeChildren>
                      </div>
                    )
                  })}
                </TreeChildren>
              </div>
            )
          })}
        </div>

        <div ref={detailRef} className="flex-1 scroll-mt-24 lg:sticky lg:top-24">
          {selectedNode && user ? (
            <StorageDetailPanel node={selectedNode} photographerId={user.id} />
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border py-20 text-center text-muted-foreground">
              <span className="text-3xl opacity-40">🗂️</span>
              <p className="text-sm font-medium">Selecciona un evento, punto u horario para ver sus detalles</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
