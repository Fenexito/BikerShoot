import { useEffect, useState } from 'react'

/** Fallback de Suspense para chunks lazy — espera 150ms antes de mostrar
 * nada para que una carga rápida (chunk ya en caché) no parpadee. */
export function RouteFallback() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 150)
    return () => clearTimeout(t)
  }, [])

  if (!show) return null

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
    </div>
  )
}
