import { useRef, useState, type DragEvent } from 'react'
import { studioEvents } from '../../data/mockStudio'
import { Select } from '../../ui/studio/Select'
import { Button } from '../../ui/studio/Button'
import { useToastStore } from '../../ui/overlays/toastStore'
import { cn } from '../../lib/cn'

interface UploadItem {
  id: string
  name: string
  url: string
  progress: number
}

export function StudioUpload() {
  const push = useToastStore((s) => s.push)
  const [eventId, setEventId] = useState(studioEvents[0]?.id ?? '')
  const [pointId, setPointId] = useState(studioEvents[0]?.points[0]?.id ?? '')
  const [dragging, setDragging] = useState(false)
  const [items, setItems] = useState<UploadItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const event = studioEvents.find((e) => e.id === eventId)

  function handleFiles(files: FileList | null) {
    if (!files || !pointId) {
      if (!pointId) push({ type: 'error', title: 'Elige un punto antes de subir fotos' })
      return
    }
    const newItems: UploadItem[] = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({ id: `${file.name}-${Date.now()}-${Math.random()}`, name: file.name, url: URL.createObjectURL(file), progress: 0 }))

    setItems((prev) => [...newItems, ...prev])

    newItems.forEach((item) => {
      const duration = 800 + Math.random() * 1200
      const start = Date.now()
      const tick = () => {
        const pct = Math.min(100, ((Date.now() - start) / duration) * 100)
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, progress: pct } : i)))
        if (pct < 100) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const doneCount = items.filter((i) => i.progress >= 100).length

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 text-foreground md:px-16">
      <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">Carga rápida</h1>
      <p className="mt-2 text-muted-foreground">Arrastra las fotos de un punto específico y súbelas en lote.</p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <Select label="Evento" value={eventId} onChange={(e) => { setEventId(e.target.value); setPointId('') }}>
          {studioEvents.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.title}</option>
          ))}
        </Select>
        <Select label="Punto y horario" value={pointId} onChange={(e) => setPointId(e.target.value)}>
          <option value="">Selecciona un punto</option>
          {event?.points.map((pt) => (
            <option key={pt.id} value={pt.id}>{pt.label} ({pt.timeStart}–{pt.timeEnd})</option>
          ))}
        </Select>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'mt-8 flex flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-16 text-center transition-colors',
          dragging ? 'border-accent bg-accent/5' : 'border-border',
        )}
      >
        <span className="text-4xl">📤</span>
        <p className="font-semibold">Arrastra tus fotos aquí</p>
        <p className="text-sm text-muted-foreground">o</p>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Elegir archivos</Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {items.length > 0 && (
        <div className="mt-10">
          <p className="mb-4 font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground">
            {doneCount} / {items.length} subidas
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {items.map((item) => (
              <div key={item.id} className="relative aspect-[4/5] overflow-hidden border border-border">
                <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                {item.progress < 100 ? (
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-1">
                    <div className="h-1 w-full bg-white/20">
                      <div className="h-full bg-accent transition-all" style={{ width: `${item.progress}%` }} />
                    </div>
                  </div>
                ) : (
                  <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs text-white">✓</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
