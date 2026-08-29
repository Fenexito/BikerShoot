import { useRef, useState, type DragEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useMyEvents } from './useMyEvents'
import { supabase } from '../../lib/supabase'
import { Select } from '../../ui/studio/Select'
import { useToastStore } from '../../ui/overlays/toastStore'
import { cn } from '../../lib/cn'

const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL as string | undefined

type UploadStatus = 'subiendo' | 'lista' | 'error'

interface UploadItem {
  id: string
  name: string
  previewUrl: string
  progress: number
  status: UploadStatus
  storagePath?: string
  errorMessage?: string
}

function uploadWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100)
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 respondió ${xhr.status}`)))
    xhr.onerror = () => reject(new Error('Error de red subiendo a R2'))
    xhr.send(file)
  })
}

export function StudioUpload() {
  const { user } = useAuth()
  const { data: events } = useMyEvents(user?.id)
  const push = useToastStore((s) => s.push)
  const [eventId, setEventId] = useState('')
  const [pointId, setPointId] = useState('')
  const [dragging, setDragging] = useState(false)
  const [items, setItems] = useState<UploadItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const event = events?.find((e) => e.id === eventId)

  async function handleFiles(files: FileList | null) {
    if (!files || !user) return
    if (!eventId) {
      push({ type: 'error', title: 'Elige un evento antes de subir fotos' })
      return
    }
    if (!pointId) {
      push({ type: 'error', title: 'Elige un punto antes de subir fotos' })
      return
    }

    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
    const newItems: UploadItem[] = imageFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: 'subiendo',
    }))
    setItems((prev) => [...newItems, ...prev])

    imageFiles.forEach(async (file, i) => {
      const itemId = newItems[i].id
      try {
        const { data, error } = await supabase.functions.invoke('r2-upload-url', {
          body: { fileName: file.name, contentType: file.type, eventId },
        })
        if (error || !data?.uploadUrl) throw new Error(error?.message ?? 'No se pudo obtener la URL de subida')

        await uploadWithProgress(data.uploadUrl, file, (pct) => {
          setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, progress: pct } : it)))
        })

        const { error: insertError } = await supabase.from('photos').insert({
          event_id: eventId,
          photographer_id: user.id,
          point_id: pointId,
          storage_path: data.storagePath,
          price: event?.price_per_photo ?? 0,
          size_bytes: file.size,
        })
        if (insertError) throw insertError

        setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, progress: 100, status: 'lista', storagePath: data.storagePath } : it)))
      } catch (err) {
        setItems((prev) =>
          prev.map((it) => (it.id === itemId ? { ...it, status: 'error', errorMessage: (err as Error).message } : it)),
        )
      }
    })
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const doneCount = items.filter((i) => i.status === 'lista').length

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 text-foreground md:px-16">
      <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">Carga rápida</h1>
      <p className="mt-2 text-muted-foreground">Arrastra las fotos de un punto específico y súbelas en lote a tu storage.</p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <Select label="Evento" value={eventId} onChange={(e) => { setEventId(e.target.value); setPointId('') }}>
          <option value="">Selecciona un evento</option>
          {events?.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.title}</option>
          ))}
        </Select>
        <Select label="Punto y horario" value={pointId} onChange={(e) => setPointId(e.target.value)} disabled={!event}>
          <option value="">Selecciona un punto</option>
          {event?.event_points.map((pt) => (
            <option key={pt.id} value={pt.id}>{pt.label} ({pt.time_start.slice(0, 5)}–{pt.time_end.slice(0, 5)})</option>
          ))}
        </Select>
      </div>

      {events && events.length === 0 && (
        <p className="mt-3 text-sm text-accent">No tienes eventos todavía — crea uno primero en "Eventos".</p>
      )}

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
        <button
          onClick={() => fileInputRef.current?.click()}
          className="border border-foreground px-6 py-3 text-sm font-semibold uppercase tracking-wider2 transition-colors hover:bg-foreground hover:text-background"
        >
          Elegir archivos
        </button>
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
            {doneCount} / {items.length} subidas a R2
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {items.map((item) => (
              <a
                key={item.id}
                href={item.status === 'lista' && item.storagePath && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${item.storagePath}` : undefined}
                target="_blank"
                rel="noreferrer"
                className="relative aspect-[4/5] overflow-hidden border border-border"
              >
                <img src={item.previewUrl} alt={item.name} className="h-full w-full object-cover" />
                {item.status === 'subiendo' && (
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
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-2 text-center text-xs text-white">
                    {item.errorMessage ?? 'Error al subir'}
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
