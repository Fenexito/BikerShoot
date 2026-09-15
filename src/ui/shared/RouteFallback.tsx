import { useEffect, useState } from 'react'
import { Progress } from './Progress'

/** Fallback de Suspense para chunks lazy — espera 150ms antes de mostrar
 * nada para que una carga rápida (chunk ya en caché) no parpadee. Barra
 * indeterminada en blanco/negro (`bg-foreground`/`bg-muted`, sigue el tema
 * activo solo) en vez del spinner circular de antes — mismo componente que
 * el resto de "página cargando" en la app. */
export function RouteFallback() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 150)
    return () => clearTimeout(t)
  }, [])

  if (!show) return null

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <Progress indeterminate className="w-40 bg-muted" />
      <p className="text-xs font-medium text-muted-foreground">Cargando…</p>
    </div>
  )
}
