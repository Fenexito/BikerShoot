import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../studio/Button'
import { useToastStore } from '../overlays/toastStore'

/** Descarga el respaldo crudo (si existe) de cada foto de la lista, una URL
 * firmada a la vez vía `r2-raw-download-url` — la única función que ya
 * existe para esto. Sin zip server-side (no hay infraestructura para eso
 * hoy): dispara descargas normales del navegador, espaciadas para no
 * chocar con el bloqueo de pop-ups. Compartido por la pantalla de
 * Almacenamiento y por el administrador embebido en el editor de evento. */
export function DownloadRawControl({ photoIds, rawPhotoIds }: { photoIds: string[]; rawPhotoIds: string[] }) {
  const push = useToastStore((s) => s.push)
  const [busy, setBusy] = useState(false)
  const skipped = photoIds.length - rawPhotoIds.length

  async function run() {
    if (rawPhotoIds.length === 0) return
    setBusy(true)
    let ok = 0
    for (const photoId of rawPhotoIds) {
      try {
        const { data, error } = await supabase.functions.invoke('r2-raw-download-url', { body: { photoId } })
        if (error || !data?.downloadUrl) continue
        const a = document.createElement('a')
        a.href = data.downloadUrl
        a.download = ''
        document.body.appendChild(a)
        a.click()
        a.remove()
        ok++
        await new Promise((r) => setTimeout(r, 350))
      } catch {
        // sigue con la siguiente
      }
    }
    setBusy(false)
    push({ type: ok > 0 ? 'success' : 'error', title: ok > 0 ? `${ok} descarga${ok === 1 ? '' : 's'} iniciada${ok === 1 ? '' : 's'}` : 'No se pudo descargar nada' })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-xs text-muted-foreground">
        {rawPhotoIds.length} foto{rawPhotoIds.length === 1 ? '' : 's'} con respaldo crudo
        {skipped > 0 && ` · ${skipped} sin respaldo (se omiten)`}
      </p>
      <Button variant="secondary" size="sm" onClick={run} loading={busy} disabled={rawPhotoIds.length === 0}>
        Descargar respaldos
      </Button>
    </div>
  )
}
