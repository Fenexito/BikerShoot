import { useState } from 'react'
import { cn } from '../../lib/cn'
import { previewUrl } from '../../lib/r2'
import { AnimateIcon } from '../animate-icons/icon'
import { LayoutDashboard } from '../animate-icons/icons/LayoutDashboard'
import { List } from '../animate-icons/icons/List'

export interface PhotoListRow {
  id: string
  filename: string | null
  bytes: number
  sold: boolean
  previewPath: string | null
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

function PhotoTile({ photo, selected, onToggle }: { photo: PhotoListRow; selected: boolean; onToggle: () => void }) {
  return (
    <label
      className={cn(
        'group relative block aspect-[4/5] cursor-pointer overflow-hidden rounded-2xl border-2 border-border bg-muted transition-colors',
        selected && 'border-accent',
      )}
      title={photo.filename ?? '(sin nombre)'}
    >
      <input type="checkbox" checked={selected} onChange={onToggle} className="absolute left-2 top-2 z-10 h-4 w-4 accent-accent" />
      {photo.previewPath ? (
        <img src={previewUrl({ storage_path: null, preview_path: photo.previewPath })} alt={photo.filename ?? ''} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">Sin vista previa</div>
      )}
      {photo.sold && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Vendida</span>
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-[10px] text-white">{photo.filename ?? '(sin nombre)'}</span>
    </label>
  )
}

/** Explorador de fotos del punto/horario seleccionado, con dos modos:
 * "lista" (nombre + tamaño en filas densas, sin miniaturas — el que ya
 * existía) y "grid" (miniaturas reales). Siempre paginado (máx. 100 por
 * página) así que el grid nunca pinta más que eso a la vez — no hace
 * falta virtualizar como en la cola de subida (ver UploadGrid), que sí
 * puede tener miles de items sin paginar. Ordenado por nombre de archivo
 * (A→Z): las cámaras nombran sus fotos de forma correlativa (FOTO_001,
 * FOTO_002...), así que el orden alfabético es también el orden en que se
 * tomaron — más fácil de ubicar una foto puntual que el orden de subida. */
export function PhotoListView({ photos, columns, onColumnsChange, pageSize, onPageSizeChange, page, onPageChange, selected, onToggle, onToggleAll }: PhotoListViewProps) {
  const [view, setView] = useState<'list' | 'grid'>('list')

  const sorted = [...photos].sort((a, b) => (a.filename ?? '').localeCompare(b.filename ?? '', undefined, { numeric: true, sensitivity: 'base' }))

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize)
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

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-full bg-muted p-1">
            <AnimateIcon animateOnHover animateOnTap asChild>
              <button
                data-no-ripple
                onClick={() => setView('list')}
                aria-label="Vista de lista"
                title="Lista"
                className={cn('flex h-7 w-7 items-center justify-center rounded-full transition-colors', view === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
              >
                <List size={14} />
              </button>
            </AnimateIcon>
            <AnimateIcon animateOnHover animateOnTap asChild>
              <button
                data-no-ripple
                onClick={() => setView('grid')}
                aria-label="Vista de cuadrícula"
                title="Grid"
                className={cn('flex h-7 w-7 items-center justify-center rounded-full transition-colors', view === 'grid' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
              >
                <LayoutDashboard size={14} />
              </button>
            </AnimateIcon>
          </div>
          {view === 'list' && (
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
          )}
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

      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No hay fotos aquí.</p>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {pageItems.map((photo) => (
            <PhotoTile key={photo.id} photo={photo} selected={selected.has(photo.id)} onToggle={() => onToggle(photo.id)} />
          ))}
        </div>
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
