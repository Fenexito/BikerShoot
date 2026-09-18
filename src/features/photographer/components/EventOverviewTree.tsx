import { useState } from 'react'
import { useEventStorageTree } from '../useEventStorageTree'
import { TreeRow, TreeChildren } from '../../../ui/shared/Tree'
import { formatBytes } from '../../../lib/formatBytes'
import { Skeleton } from '../../../ui/shared/Skeleton'

/** Resumen de solo lectura del evento — mismo árbol punto → horario que el
 * administrador de almacenamiento del editor (mismos datos, vía
 * useEventStorageTree), pero sin ninguna acción: no sube, no mueve, no
 * borra. Nace de que el fotógrafo, sobre todo desde el celular, quería
 * poder abrir el evento y ver de un vistazo cuántos puntos tiene, cuántos
 * horarios por punto, cuántas fotos y cuánto espacio ocupa cada rama —
 * sin tener que desplegar cada tarjeta de punto una por una para
 * enterarse. Para cambiar algo, el fotógrafo va al editor del evento. */
export function EventOverviewTree({ eventId }: { eventId: string }) {
  const { data, isLoading } = useEventStorageTree(eventId)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (isLoading) return <Skeleton className="h-32 w-full rounded-3xl" />
  if (!data) return null

  const { points, featured } = data
  if (points.length === 0 && featured.totalPhotos === 0) return null

  const totalPhotos = points.reduce((s, p) => s + p.totalPhotos, 0) + featured.totalPhotos
  const totalBytes = points.reduce((s, p) => s + p.bytes, 0) + featured.bytes

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-studio text-lg font-bold tracking-tight2">Resumen del evento</h2>
        <p className="text-xs font-medium text-muted-foreground">
          {points.length} punto{points.length === 1 ? '' : 's'} · {totalPhotos} foto{totalPhotos === 1 ? '' : 's'} · {formatBytes(totalBytes)}
        </p>
      </div>

      <div className="flex flex-col gap-0.5">
        {featured.totalPhotos > 0 && (
          <TreeRow
            depth={0}
            icon="⭐"
            label="Destacadas"
            stats={`${featured.totalPhotos} · ${formatBytes(featured.bytes)}`}
            hasChildren={false}
            expanded={false}
            selected={false}
            onToggle={() => {}}
            onSelect={() => {}}
          />
        )}
        {points.map((point) => {
          const key = point.id ?? '__sin-punto__'
          const open = expanded.has(key)
          const hasChildren = point.horarios.length > 0 || (point.leftover?.totalPhotos ?? 0) > 0
          return (
            <div key={key}>
              <TreeRow
                depth={0}
                icon="📂"
                label={point.label}
                stats={`${point.totalPhotos} · ${formatBytes(point.bytes)}`}
                hasChildren={hasChildren}
                expanded={open}
                selected={false}
                // TreeRow llama onSelect() SIEMPRE y onToggle() solo si hay
                // hijos — mandar el mismo toggle() a los dos disparaba dos
                // toggles por click (se cancelaban entre sí, parecía que no
                // hacía nada). onSelect no tiene nada que hacer acá, no hay
                // panel de detalle que "seleccionar" en esta vista de solo
                // lectura.
                onToggle={() => toggle(key)}
                onSelect={() => {}}
              />
              <TreeChildren open={open}>
                {point.horarios.map((h) => (
                  <TreeRow
                    key={h.key}
                    depth={1}
                    icon="🕐"
                    label={`${h.start}–${h.end}`}
                    stats={`${h.totalPhotos} · ${formatBytes(h.bytes)}`}
                    hasChildren={false}
                    expanded={false}
                    selected={false}
                    onToggle={() => {}}
                    onSelect={() => {}}
                  />
                ))}
                {point.leftover && point.leftover.totalPhotos > 0 && (
                  <TreeRow
                    depth={1}
                    icon="🕐"
                    label="Sin horario declarado"
                    stats={`${point.leftover.totalPhotos} · ${formatBytes(point.leftover.bytes)}`}
                    hasChildren={false}
                    expanded={false}
                    selected={false}
                    onToggle={() => {}}
                    onSelect={() => {}}
                  />
                )}
              </TreeChildren>
            </div>
          )
        })}
      </div>
    </div>
  )
}
