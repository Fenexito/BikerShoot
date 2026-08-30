import { useEffect, useRef, useState, type DragEvent } from 'react'
import { supabase } from '../../../lib/supabase'
import { r2Url, previewUrl } from '../../../lib/r2'
import { uploadWithProgress, loadWatermarkImage, createWatermarkedPreview } from '../photoUpload'
import { Button } from '../../../ui/studio/Button'
import { useToastStore } from '../../../ui/overlays/toastStore'
import { cn } from '../../../lib/cn'

const CONCURRENCY = 4

type ItemStatus = 'pendiente' | 'subiendo' | 'lista' | 'error'

interface QueueItem {
  id: string
  file: File
  name: string
  size: number
  localPreview: string
  status: ItemStatus
  progress: number
  errorMessage?: string
  previewPath?: string
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

interface PhotoUploadQueueProps {
  eventId: string
  pointId: string | null
  photographerId: string
  price: number
  watermarkPath: string | null
  onItemUploaded?: () => void
}

export function PhotoUploadQueue({ eventId, pointId, photographerId, price, watermarkPath, onItemUploaded }: PhotoUploadQueueProps) {
  const push = useToastStore((s) => s.push)
  const itemsRef = useRef<QueueItem[]>([])
  const activeCountRef = useRef(0)
  const watermarkImageRef = useRef<ImageBitmap | null>(null)
  const [, setTick] = useState(0)
  const [backupRaw, setBackupRaw] = useState(false)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const rerender = () => setTick((t) => t + 1)

  useEffect(() => {
    watermarkImageRef.current = null
    if (!watermarkPath) return
    let cancelled = false
    loadWatermarkImage(r2Url(watermarkPath))
      .then((bitmap) => {
        if (!cancelled) watermarkImageRef.current = bitmap
      })
      .catch(() => {
        if (!cancelled) push({ type: 'error', title: 'No se pudo cargar la marca de agua del evento' })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watermarkPath])

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      const busy = itemsRef.current.some((i) => i.status === 'pendiente' || i.status === 'subiendo')
      if (busy) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  function updateItem(id: string, patch: Partial<QueueItem>) {
    const item = itemsRef.current.find((i) => i.id === id)
    if (!item) return
    Object.assign(item, patch)
    rerender()
  }

  function pump() {
    while (activeCountRef.current < CONCURRENCY) {
      const next = itemsRef.current.find((i) => i.status === 'pendiente')
      if (!next) break
      next.status = 'subiendo'
      activeCountRef.current++
      rerender()
      runItem(next).finally(() => {
        activeCountRef.current--
        pump()
      })
    }
  }

  async function runItem(item: QueueItem) {
    try {
      const { data, error } = await supabase.functions.invoke('r2-upload-url', {
        body: { fileName: item.file.name, contentType: item.file.type, eventId, includeRaw: backupRaw },
      })
      if (error || !data?.previewUploadUrl) throw new Error(error?.message ?? 'No se pudo obtener la URL de subida')

      const previewBlob = await createWatermarkedPreview(item.file, watermarkImageRef.current)

      let previewPct = 0
      let rawPct = backupRaw ? 0 : 100
      const reportProgress = () => updateItem(item.id, { progress: (previewPct + rawPct) / 2 })

      const uploads = [uploadWithProgress(data.previewUploadUrl, previewBlob, 'image/jpeg', (pct) => { previewPct = pct; reportProgress() })]
      if (backupRaw && data.rawUploadUrl) {
        uploads.push(uploadWithProgress(data.rawUploadUrl, item.file, item.file.type, (pct) => { rawPct = pct; reportProgress() }))
      }
      await Promise.all(uploads)

      const { error: insertError } = await supabase.from('photos').insert({
        event_id: eventId,
        photographer_id: photographerId,
        point_id: pointId,
        preview_path: data.previewPath,
        raw_path: backupRaw ? data.rawPath : null,
        price,
        size_bytes: previewBlob.size + (backupRaw ? item.file.size : 0),
        original_filename: item.file.name,
      })
      if (insertError) throw insertError

      updateItem(item.id, { status: 'lista', progress: 100, previewPath: data.previewPath })
      onItemUploaded?.()
    } catch (err) {
      updateItem(item.id, { status: 'error', errorMessage: (err as Error).message })
    }
  }

  function enqueue(files: FileList | File[] | null) {
    if (!files) return
    const imageFiles = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .sort((a, b) => a.name.localeCompare(b.name))
    if (imageFiles.length === 0) return

    const newItems: QueueItem[] = imageFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      name: file.name,
      size: file.size,
      localPreview: URL.createObjectURL(file),
      status: 'pendiente',
      progress: 0,
    }))
    itemsRef.current = [...itemsRef.current, ...newItems]
    rerender()
    pump()
  }

  function retry(id: string) {
    updateItem(id, { status: 'pendiente', progress: 0, errorMessage: undefined })
    pump()
  }

  function retryAllFailed() {
    let any = false
    for (const i of itemsRef.current) {
      if (i.status === 'error') {
        i.status = 'pendiente'
        i.progress = 0
        i.errorMessage = undefined
        any = true
      }
    }
    if (any) {
      rerender()
      pump()
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    enqueue(e.dataTransfer.files)
  }

  const items = itemsRef.current
  const doneCount = items.filter((i) => i.status === 'lista').length
  const errorCount = items.filter((i) => i.status === 'error').length
  const busyCount = items.filter((i) => i.status === 'pendiente' || i.status === 'subiendo').length

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-2 border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragging ? 'border-accent bg-accent/5' : 'border-border',
        )}
      >
        <p className="text-sm font-semibold">Arrastra tus fotos aquí</p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="border border-foreground px-4 py-2 text-xs font-semibold uppercase tracking-wider2 transition-colors hover:bg-foreground hover:text-background"
        >
          Elegir archivos
        </button>
        <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => enqueue(e.target.files)} />
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={backupRaw} onChange={(e) => setBackupRaw(e.target.checked)} className="h-3.5 w-3.5 accent-accent" />
        Respaldar también el original sin editar (opcional)
      </label>

      {items.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground">
              {doneCount}/{items.length} listas
              {busyCount > 0 && ` · ${busyCount} en cola`}
              {errorCount > 0 && ` · ${errorCount} fallidas`}
            </p>
            <div className="flex items-center gap-2">
              {errorCount > 0 && (
                <Button variant="ghost" onClick={retryAllFailed}>Reintentar todos los fallidos</Button>
              )}
              <div className="flex border border-border">
                <button
                  onClick={() => setView('grid')}
                  className={cn('px-2 py-1 text-xs uppercase tracking-wider2', view === 'grid' ? 'bg-foreground text-background' : 'text-muted-foreground')}
                >
                  Grid
                </button>
                <button
                  onClick={() => setView('list')}
                  className={cn('px-2 py-1 text-xs uppercase tracking-wider2', view === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground')}
                >
                  Lista
                </button>
              </div>
            </div>
          </div>

          {view === 'grid' ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {items.map((item) => (
                <a
                  key={item.id}
                  href={item.status === 'lista' && item.previewPath ? previewUrl({ storage_path: null, preview_path: item.previewPath }) : undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="relative aspect-[4/5] overflow-hidden border border-border"
                  title={`${item.name} · ${formatBytes(item.size)}`}
                >
                  <img src={item.localPreview} alt={item.name} className="h-full w-full object-cover" />
                  {(item.status === 'pendiente' || item.status === 'subiendo') && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-1">
                      <div className="h-1 w-full bg-white/20">
                        <div className="h-full bg-accent transition-all" style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>
                  )}
                  {item.status === 'lista' && (
                    <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs text-white">✓</div>
                  )}
                  {item.status === 'error' && (
                    <button
                      onClick={(e) => { e.preventDefault(); retry(item.id) }}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/80 p-2 text-center text-[10px] text-white"
                    >
                      <span>{item.errorMessage ?? 'Error al subir'}</span>
                      <span className="font-bold uppercase tracking-wider2 text-accent">Reintentar</span>
                    </button>
                  )}
                </a>
              ))}
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border border border-border">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2">
                  <img src={item.localPreview} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{item.name}</p>
                    <p className="font-studio-mono text-[10px] text-muted-foreground">{formatBytes(item.size)}</p>
                  </div>
                  <div className="w-32 shrink-0">
                    {item.status === 'error' ? (
                      <p className="truncate text-[10px] text-accent">{item.errorMessage ?? 'Error'}</p>
                    ) : (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full transition-all', item.status === 'lista' ? 'bg-emerald-500' : 'bg-accent')}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="w-16 shrink-0 text-right">
                    {item.status === 'lista' && <span className="text-emerald-500">✓</span>}
                    {item.status === 'error' && (
                      <button onClick={() => retry(item.id)} className="text-xs font-semibold uppercase tracking-wider2 text-accent hover:underline">
                        Reintentar
                      </button>
                    )}
                    {(item.status === 'pendiente' || item.status === 'subiendo') && (
                      <span className="font-studio-mono text-[10px] text-muted-foreground">{Math.round(item.progress)}%</span>
                    )}
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
