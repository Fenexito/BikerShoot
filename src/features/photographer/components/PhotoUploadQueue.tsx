import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryClient } from '../../../lib/queryClient'
import { supabase } from '../../../lib/supabase'
import { r2Url } from '../../../lib/r2'
import { uploadWithProgress, loadWatermarkImage, createWatermarkedPreview, createLocalThumbnail, hashFile, extractCapturedAt } from '../photoUpload'
import { isAcceptedImageFile, resolveContentType, IMAGE_INPUT_ACCEPT } from '../../../lib/rawImage'
import { mapWithConcurrency } from '../../../lib/concurrency'
import { computeSegments } from '../photoSegments'
import { Button } from '../../../ui/studio/Button'
import { useToastStore } from '../../../ui/overlays/toastStore'
import { confirmDialog } from '../../../ui/overlays/confirmStore'
import { segmentPickerDialog, type SegmentOption } from '../../../ui/overlays/segmentPickerStore'
import { AnimateIcon } from '../../../ui/animate-icons/icon'
import { LayoutDashboard } from '../../../ui/animate-icons/icons/LayoutDashboard'
import { List } from '../../../ui/animate-icons/icons/List'
import { cn } from '../../../lib/cn'
import { UploadGrid } from './UploadGrid'
import { UploadList } from './UploadList'

const CONCURRENCY = 4
// Cuántos archivos se procesan a la vez en el pre-escaneo (hash + EXIF) y
// en la generación de miniaturas locales — cada uno lee el archivo entero
// en memoria (hash) o lo decodifica (miniatura). Sin límite, elegir miles
// de fotos a la vez dispara cientos de ArrayBuffers/decodificaciones en
// paralelo y puede tumbar la pestaña; con límite, el navegador nunca tiene
// más que esto en vuelo sin importar si son 10 fotos o 15,000.
const SCAN_CONCURRENCY = 6
const THUMBNAIL_CONCURRENCY = 4
// Se deja el check verde visible un momento antes de quitarla de la cola —
// para entonces ya es parte de las fotos del punto/evento más abajo, así
// que dejarla aquí también sería confuso (¿es la misma foto dos veces?).
const REMOVE_DONE_DELAY = 1400

type ItemStatus = 'pendiente' | 'subiendo' | 'lista' | 'error'

export interface QueueItem {
  id: string
  file: File
  name: string
  size: number
  /** Object URL de una miniatura YA reescalada a ~220px — nunca del
   * archivo completo (antes se usaba `URL.createObjectURL(file)` directo,
   * que obligaba al navegador a decodificar el original en alta
   * resolución solo para pintar un cuadrito pequeño; con cientos de fotos
   * eso es lo que ponía lenta la página). Null mientras se genera (se
   * muestra un placeholder), o si el archivo no se pudo decodificar. */
  localPreview: string | null
  status: ItemStatus
  progress: number
  errorMessage?: string
  previewPath?: string
  backupRaw: boolean
  hash: string
  /** El mismo valor viaja en la firma de la URL de subida del respaldo Y en
   * el PUT real — tienen que coincidir exacto o R2 rechaza la firma. Nunca
   * usar `file.type` directo en más de un lugar (viene vacío en RAW). */
  contentType: string
  forcedCapturedAt?: string
  /** Hora leída del EXIF, precalculada en `enqueue()` (no en `runItem`) —
   * así el mismo dato sirve para decidir ANTES de subir si hace falta
   * avisar al fotógrafo que varias fotos no traen hora, sin leer el EXIF
   * dos veces por archivo. */
  exifCapturedAt: string | null
}

interface PhotoUploadQueueProps {
  eventId: string
  pointId: string | null
  photographerId: string
  price: number
  watermarkPath: string | null
  onItemUploaded?: () => void
  /** Si se da (ISO), se usa como `captured_at` de TODAS las fotos de esta
   * cola en vez de leer el EXIF — para cuando el fotógrafo sube directo a
   * un horario ya declarado a mano (fotos sin metadata, o quiere forzar el
   * horario sin importar lo que diga el EXIF). Lo usan las colas ya
   * ancladas a un horario específico ("Cargar fotos" por segmento). */
  forcedCapturedAt?: string
  /** Horarios declarados del punto — si se dan (y no hay `forcedCapturedAt`
   * fijo), justo después de elegir/soltar archivos se pregunta a cuál
   * horario pertenecen (modal), antes de preguntar por el respaldo. Lo usa
   * el botón genérico "+ Subir fotos" de un punto con horarios. */
  manualSegments?: SegmentOption[]
  /** Fecha del evento (YYYY-MM-DD) — necesaria para construir el
   * `captured_at` a partir del horario elegido en `manualSegments`. */
  eventDate?: string
}

export function PhotoUploadQueue({ eventId, pointId, photographerId, price, watermarkPath, onItemUploaded, forcedCapturedAt, manualSegments, eventDate }: PhotoUploadQueueProps) {
  const push = useToastStore((s) => s.push)
  const itemsRef = useRef<QueueItem[]>([])
  const activeCountRef = useRef(0)
  const watermarkImageRef = useRef<ImageBitmap | null>(null)
  const [, setTick] = useState(0)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [dragging, setDragging] = useState(false)
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const knownHashesRef = useRef<Set<string>>(new Set())

  const rerender = () => setTick((t) => t + 1)

  // Hashes de todo lo que ya existe en este evento (cualquier punto) — un
  // duplicado no debería colarse solo porque se sube a un punto distinto.
  const { data: existingHashes } = useQuery({
    queryKey: ['event-photo-hashes', eventId],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('photos').select('content_hash').eq('event_id', eventId).not('content_hash', 'is', null)
      if (error) throw error
      return (data ?? []).map((r) => r.content_hash as string)
    },
  })

  useEffect(() => {
    if (existingHashes) for (const h of existingHashes) knownHashesRef.current.add(h)
  }, [existingHashes])

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

  function removeItem(id: string) {
    const item = itemsRef.current.find((i) => i.id === id)
    // La miniatura es un object URL propio (no el archivo original) —
    // hay que liberarlo o se queda en memoria el resto de la sesión.
    if (item?.localPreview) URL.revokeObjectURL(item.localPreview)
    itemsRef.current = itemsRef.current.filter((i) => i.id !== id)
    rerender()
  }

  function updateItem(id: string, patch: Partial<QueueItem>) {
    const item = itemsRef.current.find((i) => i.id === id)
    if (!item) return
    Object.assign(item, patch)
    rerender()
    if (patch.status === 'lista') {
      setTimeout(() => removeItem(id), REMOVE_DONE_DELAY)
    }
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
        body: { fileName: item.file.name, contentType: item.contentType, eventId, includeRaw: item.backupRaw },
      })
      if (error || !data?.previewUploadUrl) throw new Error(error?.message ?? 'No se pudo obtener la URL de subida')

      // El EXIF ya se leyó en `enqueue()` (una sola vez, antes de decidir si
      // hacía falta avisar sobre fotos sin hora) — no se vuelve a leer acá.
      const previewBlob = await createWatermarkedPreview(item.file, watermarkImageRef.current)
      const capturedAt = item.forcedCapturedAt ?? item.exifCapturedAt

      let previewPct = 0
      let rawPct = item.backupRaw ? 0 : 100
      const reportProgress = () => updateItem(item.id, { progress: (previewPct + rawPct) / 2 })

      const uploads = [uploadWithProgress(data.previewUploadUrl, previewBlob, 'image/jpeg', (pct) => { previewPct = pct; reportProgress() })]
      if (item.backupRaw && data.rawUploadUrl) {
        uploads.push(uploadWithProgress(data.rawUploadUrl, item.file, item.contentType, (pct) => { rawPct = pct; reportProgress() }))
      }
      await Promise.all(uploads)

      const { error: insertError } = await supabase.from('photos').insert({
        event_id: eventId,
        photographer_id: photographerId,
        point_id: pointId,
        preview_path: data.previewPath,
        raw_path: item.backupRaw ? data.rawPath : null,
        price,
        size_bytes: previewBlob.size + (item.backupRaw ? item.file.size : 0),
        preview_size_bytes: previewBlob.size,
        raw_size_bytes: item.backupRaw ? item.file.size : 0,
        original_filename: item.file.name,
        content_hash: item.hash,
        captured_at: capturedAt,
      })
      if (insertError) throw insertError

      updateItem(item.id, { status: 'lista', progress: 100, previewPath: data.previewPath })
      queryClient.invalidateQueries({ queryKey: ['event-photo-hashes', eventId] })
      onItemUploaded?.()
    } catch (err) {
      updateItem(item.id, { status: 'error', errorMessage: (err as Error).message })
    }
  }

  async function enqueue(files: FileList | File[] | null) {
    if (!files) return
    const imageFiles = Array.from(files)
      .filter(isAcceptedImageFile)
      .sort((a, b) => a.name.localeCompare(b.name))
    if (imageFiles.length === 0) return

    // Un solo pase revisa TRES cosas por archivo: el hash (duplicados), la
    // hora real de la toma (EXIF) y el content-type a usar — leer el EXIF
    // aquí, antes de subir nada, es lo que permite avisar "N de M fotos no
    // traen hora" en vez de que el fotógrafo confíe en que el EXIF "va a
    // funcionar" y descubra hasta después de subir cientos de fotos que
    // muchas quedaron sin horario. Con límite de concurrencia (no
    // Promise.all sin tope): cada archivo se lee completo en memoria para
    // el hash, y con miles de fotos a la vez eso satura la pestaña.
    setCheckingDuplicates(true)
    const scanned = await mapWithConcurrency(imageFiles, SCAN_CONCURRENCY, async (file) => ({
      file,
      hash: await hashFile(file),
      exifCapturedAt: forcedCapturedAt ? null : await extractCapturedAt(file),
      contentType: resolveContentType(file),
    }))
    setCheckingDuplicates(false)

    const unique: { file: File; hash: string; exifCapturedAt: string | null; contentType: string }[] = []
    let duplicateCount = 0
    for (const item of scanned) {
      if (knownHashesRef.current.has(item.hash)) {
        duplicateCount++
        continue
      }
      knownHashesRef.current.add(item.hash)
      unique.push(item)
    }

    if (duplicateCount > 0) {
      push({
        type: 'error',
        title: duplicateCount === 1 ? 'Se omitió 1 foto duplicada' : `Se omitieron ${duplicateCount} fotos duplicadas`,
        description: 'Ya existen fotos con este mismo contenido en este evento.',
      })
    }
    if (unique.length === 0) return

    function forgetAsUploaded() {
      // Cancelar aquí no debe dejar estas fotos marcadas como "ya
      // subidas" — si no, un reintento con los mismos archivos las
      // rechazaría como falsos duplicados sin haberse subido nunca.
      for (const item of unique) knownHashesRef.current.delete(item.hash)
    }

    // Cuántas de este lote SÍ traen hora vs. cuántas no — la decisión de
    // pedir un horario manual (y a cuáles fotos aplicarlo) se basa en esto,
    // no en si el punto tiene horarios declarados nada más.
    const missing = forcedCapturedAt ? [] : unique.filter((u) => !u.exifCapturedAt)
    let missingForcedCapturedAt: string | undefined

    if (!forcedCapturedAt && missing.length === unique.length) {
      // Ninguna trae hora — no hay nada que "confirmar", solo decidir qué
      // hacer: asignarlas a mano a un horario ya declarado, o avisar que
      // van a quedar sin clasificar.
      if (manualSegments && manualSegments.length > 0 && eventDate) {
        const chosen: SegmentOption | null = await segmentPickerDialog.ask({
          segments: manualSegments,
          title: `Ninguna de estas ${unique.length} foto${unique.length === 1 ? '' : 's'} trae hora en sus metadatos`,
          description: 'Elige a qué horario asignarlas todas.',
        })
        if (!chosen) {
          forgetAsUploaded()
          return
        }
        missingForcedCapturedAt = new Date(`${eventDate}T${chosen.start}:00`).toISOString()
      } else {
        const ok = await confirmDialog.ask({
          title: `Ninguna de estas ${unique.length} foto${unique.length === 1 ? '' : 's'} trae hora en sus metadatos`,
          description: 'Quedarán "sin horario" dentro de este punto — declara horarios para el punto si quieres poder asignárselos luego, o continúa y ordénalas manualmente después.',
          confirmLabel: 'Continuar de todos modos',
        })
        if (!ok) {
          forgetAsUploaded()
          return
        }
      }
    } else if (!forcedCapturedAt) {
      // Al menos una trae hora (el caso normal) — SIEMPRE se confirma antes
      // de subir, mostrando en qué horarios va a quedar clasificado el
      // lote completo, en vez de subir en silencio y que el fotógrafo se
      // entere después revisando la galería si de verdad quedó bien.
      const segments = computeSegments(unique.map((u, i) => ({ id: String(i), captured_at: u.exifCapturedAt })))
      const summary = segments
        ? segments.map((s) => `${s.label}: ${s.photos.length} foto${s.photos.length === 1 ? '' : 's'}`).join(' · ')
        : (() => {
            // Un único bloque de 15 min, todas con hora — computeSegments
            // no lo cuenta como "segmento" (no hace falta esa capa extra en
            // la galería), pero igual vale confirmar la hora detectada.
            const times = unique.map((u) => new Date(u.exifCapturedAt!).getTime())
            const fmt = (t: number) => new Date(t).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })
            const min = Math.min(...times)
            const max = Math.max(...times)
            return `Todas alrededor de ${fmt(min)}${max !== min ? ` – ${fmt(max)}` : ''}`
          })()

      const ok = await confirmDialog.ask({
        title: `Vamos a clasificar ${unique.length} foto${unique.length === 1 ? '' : 's'} así`,
        description: summary,
        confirmLabel: 'Sí, continuar',
        cancelLabel: 'Cancelar',
      })
      if (!ok) {
        forgetAsUploaded()
        return
      }

      // Ya confirmado que se van a subir — si además hay algunas sin hora
      // (mezcladas con otras que sí traen), se puede elegir a qué horario
      // declarado asignar esas específicamente.
      if (missing.length > 0 && manualSegments && manualSegments.length > 0 && eventDate) {
        const chosen: SegmentOption | null = await segmentPickerDialog.ask({
          segments: manualSegments,
          title: `${missing.length} de estas fotos no traen hora en sus metadatos`,
          description: `Las ${unique.length - missing.length} que sí traen hora ya se clasificaron solas. Elige a qué horario asignar las ${missing.length} que no.`,
        })
        if (chosen) missingForcedCapturedAt = new Date(`${eventDate}T${chosen.start}:00`).toISOString()
      }
    }

    const backupRaw = await confirmDialog.ask({
      title: `¿Respaldar el original de ${unique.length === 1 ? 'esta foto' : `estas ${unique.length} fotos`}?`,
      description: 'Guarda una copia sin editar (sin marca de agua) además de la vista previa. Ocupa más espacio de tu plan.',
      confirmLabel: 'Sí, respaldar también',
      cancelLabel: 'No, solo vista previa',
    })

    const newItems: QueueItem[] = unique.map(({ file, hash, exifCapturedAt, contentType }) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      name: file.name,
      size: file.size,
      localPreview: null,
      status: 'pendiente',
      progress: 0,
      backupRaw,
      hash,
      contentType,
      exifCapturedAt,
      forcedCapturedAt: forcedCapturedAt ?? (!exifCapturedAt ? missingForcedCapturedAt : undefined),
    }))
    itemsRef.current = [...itemsRef.current, ...newItems]
    rerender()
    pump()
    generateThumbnails(newItems)
  }

  /** Miniaturas generadas EN SEGUNDO PLANO, después de arrancar la subida —
   * son solo cosméticas (la cola local), nunca deben demorar el arranque
   * de la subida real. Concurrencia limitada por la misma razón que el
   * pre-escaneo: decodificar miles de fotos a la vez de golpe es justo lo
   * que ponía lenta la página. */
  async function generateThumbnails(newItems: QueueItem[]) {
    await mapWithConcurrency(newItems, THUMBNAIL_CONCURRENCY, async (item) => {
      const url = await createLocalThumbnail(item.file)
      const stillQueued = itemsRef.current.some((i) => i.id === item.id)
      if (!stillQueued) {
        if (url) URL.revokeObjectURL(url)
        return
      }
      updateItem(item.id, { localPreview: url })
    })
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
          'flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragging ? 'border-accent bg-accent/5' : 'border-border',
        )}
      >
        <p className="text-sm font-semibold">Arrastra tus fotos aquí</p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={checkingDuplicates}
          className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {checkingDuplicates ? 'Revisando fotos…' : 'Elegir archivos'}
        </button>
        <input ref={fileInputRef} type="file" multiple accept={IMAGE_INPUT_ACCEPT} className="hidden" onChange={(e) => enqueue(e.target.files)} />
      </div>

      {items.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {doneCount}/{items.length} listas
              {busyCount > 0 && ` · ${busyCount} en cola`}
              {errorCount > 0 && ` · ${errorCount} fallidas`}
            </p>
            <div className="flex items-center gap-2">
              {errorCount > 0 && (
                <Button variant="ghost" onClick={retryAllFailed}>Reintentar todos los fallidos</Button>
              )}
              <div className="flex gap-1 rounded-full bg-muted p-1">
                <AnimateIcon animateOnHover animateOnTap asChild>
                  <button
                    onClick={() => setView('grid')}
                    aria-label="Vista de cuadrícula"
                    title="Grid"
                    className={cn('flex h-8 w-8 items-center justify-center rounded-full transition-colors', view === 'grid' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
                  >
                    <LayoutDashboard size={16} />
                  </button>
                </AnimateIcon>
                <AnimateIcon animateOnHover animateOnTap asChild>
                  <button
                    onClick={() => setView('list')}
                    aria-label="Vista de lista"
                    title="Lista"
                    className={cn('flex h-8 w-8 items-center justify-center rounded-full transition-colors', view === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
                  >
                    <List size={16} />
                  </button>
                </AnimateIcon>
              </div>
            </div>
          </div>

          {view === 'grid' ? <UploadGrid items={items} onRetry={retry} /> : <UploadList items={items} onRetry={retry} />}
        </div>
      )}
    </div>
  )
}
