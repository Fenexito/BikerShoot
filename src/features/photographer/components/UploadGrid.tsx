import { useState } from 'react'
import { Grid, type CellComponentProps } from 'react-window'
import { previewUrl } from '../../../lib/r2'
import { formatBytes } from '../../../lib/formatBytes'
import { Progress } from '../../../ui/shared/Progress'
import type { QueueItem } from './PhotoUploadQueue'

const MIN_COLUMN_WIDTH = 110
const GRID_HEIGHT = 560

interface CellProps {
  items: QueueItem[]
  columnCount: number
  onRetry: (id: string) => void
}

function GridCell({ columnIndex, rowIndex, style, items, columnCount, onRetry }: CellComponentProps<CellProps>) {
  const index = rowIndex * columnCount + columnIndex
  const item = items[index]
  if (!item) return null

  return (
    // react-window no tiene noción de "gap" entre celdas — se simula con
    // este padding parejo (~10px totales entre tiles adyacentes).
    <div style={style} className="p-[5px]">
      <a
        href={item.status === 'lista' && item.previewPath ? previewUrl({ storage_path: null, preview_path: item.previewPath }) : undefined}
        target="_blank"
        rel="noreferrer"
        className="relative block h-full w-full overflow-hidden rounded-2xl border border-border bg-muted"
        title={`${item.name} · ${formatBytes(item.size)}`}
      >
        {item.localPreview ? (
          <img src={item.localPreview} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">…</div>
        )}
        {(item.status === 'pendiente' || item.status === 'subiendo') && (
          <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-1">
            <Progress value={item.progress} className="h-1 w-full bg-white/20" />
          </div>
        )}
        {item.status === 'lista' && (
          <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs text-white">✓</div>
        )}
        {item.status === 'error' && (
          <button
            onClick={(e) => { e.preventDefault(); onRetry(item.id) }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/80 p-2 text-center text-[10px] text-white"
          >
            <span>{item.errorMessage ?? 'Error al subir'}</span>
            <span className="font-bold uppercase tracking-wide text-accent">Reintentar</span>
          </button>
        )}
      </a>
    </div>
  )
}

/** Grid virtualizada de la cola de subida — react-window solo monta las
 * celdas visibles (+ overscan) en el DOM, sin importar si hay 10 fotos o
 * 15,000. Antes se pintaba un <img> por cada foto de la cola completa de
 * una — con cientos de fotos eso por sí solo (aparte de que cada <img>
 * cargaba el archivo COMPLETO, ver createLocalThumbnail) ponía lenta la
 * página con el DOM tan grande. */
export function UploadGrid({ items, onRetry }: { items: QueueItem[]; onRetry: (id: string) => void }) {
  const [width, setWidth] = useState(900)
  const columnCount = Math.max(3, Math.floor(width / MIN_COLUMN_WIDTH))
  const columnWidth = width / columnCount
  const rowHeight = columnWidth * 1.25 // aspect-[4/5]
  const rowCount = Math.ceil(items.length / columnCount)

  return (
    <div className="w-full overflow-hidden" style={{ height: Math.min(GRID_HEIGHT, rowHeight * rowCount || GRID_HEIGHT) }}>
      <Grid
        cellComponent={GridCell}
        cellProps={{ items, columnCount, onRetry }}
        columnCount={columnCount}
        columnWidth={columnWidth}
        rowCount={rowCount}
        rowHeight={rowHeight}
        overscanCount={4}
        onResize={({ width: w }) => setWidth(w)}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  )
}
