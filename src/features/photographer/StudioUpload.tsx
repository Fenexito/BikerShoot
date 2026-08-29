import { useRef, useState, type DragEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useMyEvents } from './useMyEvents'
import { usePhotographerDetails } from './usePhotographerDetails'
import { supabase } from '../../lib/supabase'
import { previewUrl } from '../../lib/r2'
import { Select } from '../../ui/studio/Select'
import { useToastStore } from '../../ui/overlays/toastStore'
import { cn } from '../../lib/cn'

const PREVIEW_MAX_SIDE = 1600
const PREVIEW_QUALITY = 0.82

type UploadStatus = 'subiendo' | 'lista' | 'error'

interface UploadItem {
  id: string
  name: string
  localPreview: string
  progress: number
  status: UploadStatus
  storagePath?: string
  previewPath?: string
  errorMessage?: string
}

function uploadWithProgress(url: string, body: Blob, contentType: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100)
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 respondió ${xhr.status}`)))
    xhr.onerror = () => reject(new Error('Error de red subiendo a R2'))
    xhr.send(body)
  })
}

/** Reescala a máx. PREVIEW_MAX_SIDE y le pone una marca de agua diagonal
 * repetida — así se protege el original de ser "robado" en alta calidad
 * antes de la compra (ver plan de watermark). */
async function createWatermarkedPreview(file: File, watermarkText: string): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, PREVIEW_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar el lienzo del preview')
  ctx.drawImage(bitmap, 0, 0, width, height)

  ctx.save()
  ctx.translate(width / 2, height / 2)
  ctx.rotate(-Math.PI / 8)
  ctx.translate(-width / 2, -height / 2)
  ctx.font = `700 ${Math.max(14, Math.round(width / 26))}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255,255,255,0.32)'
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'
  ctx.lineWidth = 1

  const stepX = width / 2
  const stepY = height / 6
  for (let y = -height * 0.5; y < height * 1.5; y += stepY) {
    for (let x = -width * 0.5; x < width * 1.5; x += stepX) {
      ctx.strokeText(watermarkText, x, y)
      ctx.fillText(watermarkText, x, y)
    }
  }
  ctx.restore()

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar el preview'))), 'image/jpeg', PREVIEW_QUALITY)
  })
}

export function StudioUpload() {
  const { user, profile } = useAuth()
  const { data: events } = useMyEvents(user?.id)
  const { data: details } = usePhotographerDetails(user?.id)
  const push = useToastStore((s) => s.push)
  const [eventId, setEventId] = useState('')
  const [pointId, setPointId] = useState('')
  const [dragging, setDragging] = useState(false)
  const [items, setItems] = useState<UploadItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const event = events?.find((e) => e.id === eventId)
  const watermarkText = [profile?.display_name, details?.whatsapp].filter(Boolean).join(' · ') || 'MotoShots'

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
      localPreview: URL.createObjectURL(file),
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
        if (error || !data?.originalUploadUrl || !data?.previewUploadUrl) {
          throw new Error(error?.message ?? 'No se pudo obtener la URL de subida')
        }

        const previewBlob = await createWatermarkedPreview(file, watermarkText)

        let originalPct = 0
        let previewPct = 0
        const updateProgress = () => {
          setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, progress: (originalPct + previewPct) / 2 } : it)))
        }

        await Promise.all([
          uploadWithProgress(data.originalUploadUrl, file, file.type, (pct) => { originalPct = pct; updateProgress() }),
          uploadWithProgress(data.previewUploadUrl, previewBlob, 'image/jpeg', (pct) => { previewPct = pct; updateProgress() }),
        ])

        const { error: insertError } = await supabase.from('photos').insert({
          event_id: eventId,
          photographer_id: user.id,
          point_id: pointId,
          storage_path: data.storagePath,
          preview_path: data.previewPath,
          price: event?.price_per_photo ?? 0,
          size_bytes: file.size,
        })
        if (insertError) throw insertError

        setItems((prev) =>
          prev.map((it) => (it.id === itemId ? { ...it, progress: 100, status: 'lista', storagePath: data.storagePath, previewPath: data.previewPath } : it)),
        )
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
      <p className="mt-2 text-muted-foreground">
        Arrastra las fotos de un punto específico y súbelas en lote — cada una se protege automáticamente con marca de agua para la vista previa; el original en alta calidad queda privado hasta que se compre.
      </p>

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
                href={item.status === 'lista' && item.previewPath ? previewUrl({ storage_path: item.storagePath!, preview_path: item.previewPath }) : undefined}
                target="_blank"
                rel="noreferrer"
                className="relative aspect-[4/5] overflow-hidden border border-border"
              >
                <img src={item.localPreview} alt={item.name} className="h-full w-full object-cover" />
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
