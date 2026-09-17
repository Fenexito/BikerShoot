import { List, type RowComponentProps } from 'react-window'
import { Progress } from '../../../ui/shared/Progress'
import { formatBytes } from '../../../lib/formatBytes'
import type { QueueItem } from './PhotoUploadQueue'

const ROW_HEIGHT = 52
const LIST_HEIGHT = 420

interface RowProps {
  items: QueueItem[]
  onRetry: (id: string) => void
}

function UploadRow({ index, style, items, onRetry }: RowComponentProps<RowProps>) {
  const item = items[index]
  if (!item) return null

  return (
    <div style={style} className="flex items-center gap-3 border-b border-border px-3">
      {item.localPreview ? (
        <img src={item.localPreview} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded object-cover" />
      ) : (
        <div className="h-10 w-10 shrink-0 rounded bg-muted" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{item.name}</p>
        <p className="text-[10px] text-muted-foreground">{formatBytes(item.size)}</p>
      </div>
      <div className="w-32 shrink-0">
        {item.status === 'error' ? (
          <p className="truncate text-[10px] text-accent">{item.errorMessage ?? 'Error'}</p>
        ) : (
          <Progress value={item.progress} indicatorClassName={item.status === 'lista' ? 'bg-emerald-500' : undefined} />
        )}
      </div>
      <div className="w-16 shrink-0 text-right">
        {item.status === 'lista' && <span className="text-emerald-500">✓</span>}
        {item.status === 'error' && (
          <button onClick={() => onRetry(item.id)} className="text-xs font-semibold uppercase tracking-wide text-accent hover:underline">
            Reintentar
          </button>
        )}
        {(item.status === 'pendiente' || item.status === 'subiendo') && (
          <span className="text-[10px] text-muted-foreground">{Math.round(item.progress)}%</span>
        )}
      </div>
    </div>
  )
}

/** Misma razón que UploadGrid: virtualizada con react-window para que la
 * cola de subida no sufra con miles de filas en el DOM a la vez. */
export function UploadList({ items, onRetry }: { items: QueueItem[]; onRetry: (id: string) => void }) {
  return (
    <div style={{ height: Math.min(LIST_HEIGHT, ROW_HEIGHT * items.length || LIST_HEIGHT) }} className="overflow-hidden rounded-2xl border border-border">
      <List
        rowComponent={UploadRow}
        rowProps={{ items, onRetry }}
        rowCount={items.length}
        rowHeight={ROW_HEIGHT}
        overscanCount={6}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  )
}
