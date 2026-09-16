import { cn } from '../../lib/cn'

export interface PhotoListRow {
  id: string
  filename: string | null
  bytes: number
  sold: boolean
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

const COLUMN_OPTIONS = [1, 2, 3] as const
const PAGE_SIZE_OPTIONS = [10, 50, 100] as const

export interface PhotoListViewProps {
  photos: PhotoListRow[]
  columns: 1 | 2 | 3
  onColumnsChange: (n: 1 | 2 | 3) => void
  pageSize: 10 | 50 | 100
  onPageSizeChange: (n: 10 | 50 | 100) => void
  page: number
  onPageChange: (n: number) => void
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (ids: string[], select: boolean) => void
}

function PhotoRow({ photo, selected, onToggle }: { photo: PhotoListRow; selected: boolean; onToggle: () => void }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-muted/60', selected && 'bg-accent/10')}>
      <input type="checkbox" checked={selected} onChange={onToggle} className="h-4 w-4 shrink-0 accent-accent" />
      <span className="min-w-0 flex-1 truncate">{photo.filename ?? '(sin nombre)'}</span>
      {photo.sold && <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">Vendida</span>}
      <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(photo.bytes)}</span>
    </label>
  )
}

/** Explorador tipo "vista de lista" (nombre + tamaño, sin miniaturas) con
 * densidad configurable — el editor de evento no debe volverse una página
 * kilométrica con cientos de miniaturas. `columns` reparte la página actual
 * en 1-3 columnas de filas (como un panel de archivos profesional), no
 * columnas de una grilla de fotos. */
export function PhotoListView({ photos, columns, onColumnsChange, pageSize, onPageSizeChange, page, onPageChange, selected, onToggle, onToggleAll }: PhotoListViewProps) {
  const totalPages = Math.max(1, Math.ceil(photos.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = photos.slice(safePage * pageSize, safePage * pageSize + pageSize)
  const pageIds = pageItems.map((p) => p.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))

  const chunkSize = Math.ceil(pageItems.length / columns) || 1
  const chunks: PhotoListRow[][] = []
  for (let i = 0; i < pageItems.length; i += chunkSize) chunks.push(pageItems.slice(i, i + chunkSize))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={allPageSelected} onChange={() => onToggleAll(pageIds, !allPageSelected)} className="h-4 w-4 accent-accent" />
          Seleccionar página
          {selected.size > 0 && <span className="font-semibold text-foreground">· {selected.size} seleccionada{selected.size === 1 ? '' : 's'}</span>}
          {selected.size > 0 && (
            <button onClick={() => onToggleAll(photos.map((p) => p.id), false)} data-no-ripple className="font-semibold text-foreground hover:underline">
              Limpiar
            </button>
          )}
          {photos.length > pageIds.length && (
            <button onClick={() => onToggleAll(photos.map((p) => p.id), true)} data-no-ripple className="font-semibold text-foreground hover:underline">
              Seleccionar las {photos.length}
            </button>
          )}
        </label>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full bg-muted p-1">
            {COLUMN_OPTIONS.map((n) => (
              <button
                key={n}
                data-no-ripple
                onClick={() => onColumnsChange(n)}
                className={cn('rounded-full px-2.5 py-1 text-xs font-semibold transition-colors', columns === n ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
                aria-label={`${n} columna${n === 1 ? '' : 's'}`}
              >
                {n}col
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-full bg-muted p-1">
            {PAGE_SIZE_OPTIONS.map((n) => (
              <button
                key={n}
                data-no-ripple
                onClick={() => onPageSizeChange(n)}
                className={cn('rounded-full px-2.5 py-1 text-xs font-semibold transition-colors', pageSize === n ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {photos.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No hay fotos aquí.</p>
      ) : (
        <div className={cn('grid gap-x-4', columns === 1 ? 'grid-cols-1' : columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3')}>
          {chunks.map((chunk, i) => (
            <div key={i} className="flex flex-col divide-y divide-border">
              {chunk.map((photo) => (
                <PhotoRow key={photo.id} photo={photo} selected={selected.has(photo.id)} onToggle={() => onToggle(photo.id)} />
              ))}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <button data-no-ripple onClick={() => onPageChange(Math.max(0, safePage - 1))} disabled={safePage === 0} className="text-xs font-semibold text-foreground hover:underline disabled:opacity-30">
            ← Anterior
          </button>
          <span className="text-xs text-muted-foreground">Página {safePage + 1} de {totalPages}</span>
          <button data-no-ripple onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1} className="text-xs font-semibold text-foreground hover:underline disabled:opacity-30">
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
