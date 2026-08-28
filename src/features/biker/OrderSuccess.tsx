import { Link, useLocation } from 'react-router-dom'
import { Button } from '../../ui/flat/Button'

export function OrderSuccess() {
  const location = useLocation()
  const state = location.state as { total?: number; count?: number } | null

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center font-flat">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">✓</span>
      <h1 className="text-3xl font-bold tracking-tight">¡Listo, {state?.count ?? 'tus'} fotos son tuyas!</h1>
      <p className="text-muted-foreground">
        {state?.total ? `Pagaste Q${state.total.toFixed(2)}. ` : ''}
        Ya puedes descargarlas en alta calidad desde tu historial de compras, sin marca de agua.
      </p>
      <div className="mt-4 flex gap-3">
        <Link to="/app/historial">
          <Button size="lg">Ver mis compras</Button>
        </Link>
        <Link to="/app/buscar">
          <Button size="lg" variant="secondary">Seguir buscando</Button>
        </Link>
      </div>
    </div>
  )
}
