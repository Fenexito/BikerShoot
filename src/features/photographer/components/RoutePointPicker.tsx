import { forwardRef, useImperativeHandle, useState } from 'react'
import { useRoutes, useRoutePoints, createRoutePoint } from '../../shared/useRoutes'
import { MapPointPicker } from './MapPointPicker'
import { Input } from '../../../ui/studio/Input'
import { Select } from '../../../ui/studio/Select'
import { Button } from '../../../ui/studio/Button'
import { useToastStore } from '../../../ui/overlays/toastStore'

const GUATEMALA_CENTER = { lat: 14.6349, lng: -90.5069 }
const NEW_POINT = '__new__'

export interface AddedPoint {
  routePointId: string | null
  label: string
  lat: number
  lng: number
  timeStart: string
  timeEnd: string
}

export interface RoutePointPickerHandle {
  /** Si hay un punto configurado pero sin agregar a la lista, lo devuelve (y limpia
   * el formulario) — para que "Guardar cambios" nunca pierda un punto que el
   * fotógrafo olvidó confirmar. No llama a onAdd: quien llama decide qué hacer. */
  commitPending: () => AddedPoint | null
}

interface SelectedPoint {
  routePointId: string | null
  label: string
  lat: number
  lng: number
}

interface RoutePointPickerProps {
  onAdd: (point: AddedPoint) => void
  /** Rodadas pueden anclar el punto a una de las rutas fijas; pista/sesión de fotos siempre son puntos sueltos. */
  showRouteSelector?: boolean
}

export const RoutePointPicker = forwardRef<RoutePointPickerHandle, RoutePointPickerProps>(function RoutePointPicker(
  { onAdd, showRouteSelector = false },
  ref,
) {
  const push = useToastStore((s) => s.push)
  const { data: routes = [] } = useRoutes()

  const [routeId, setRouteId] = useState('')
  const { data: routePoints = [] } = useRoutePoints(routeId || undefined)

  const [pointFormOpen, setPointFormOpen] = useState(true)
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newLat, setNewLat] = useState(GUATEMALA_CENTER.lat)
  const [newLng, setNewLng] = useState(GUATEMALA_CENTER.lng)
  const [savingPoint, setSavingPoint] = useState(false)

  const [timeStart, setTimeStart] = useState('05:00')
  const [timeEnd, setTimeEnd] = useState('05:30')

  function resetPointForm() {
    setSelectedPoint(null)
    setNewLabel('')
    setNewLat(GUATEMALA_CENTER.lat)
    setNewLng(GUATEMALA_CENTER.lng)
  }

  function handleRouteChange(value: string) {
    setRouteId(value)
    resetPointForm()
    setPointFormOpen(!value)
  }

  function handlePointChange(value: string) {
    if (value === NEW_POINT) {
      setPointFormOpen(true)
      setSelectedPoint(null)
    } else {
      const found = routePoints.find((p) => p.id === value)
      if (found) {
        setSelectedPoint({ routePointId: found.id, label: found.label, lat: found.lat, lng: found.lng })
        setPointFormOpen(false)
      }
    }
  }

  async function handleCreatePoint() {
    if (!newLabel.trim()) {
      push({ type: 'error', title: 'Ponle un nombre al punto' })
      return
    }
    setSavingPoint(true)
    try {
      const point = await createRoutePoint(routeId, newLabel.trim(), newLat, newLng)
      setSelectedPoint({ routePointId: point.id, label: point.label, lat: point.lat, lng: point.lng })
      setPointFormOpen(false)
      setNewLabel('')
    } catch (err) {
      push({ type: 'error', title: 'No se pudo crear el punto', description: (err as Error).message })
    } finally {
      setSavingPoint(false)
    }
  }

  const usingRoute = showRouteSelector && !!routeId
  const readyToTime = usingRoute ? !!selectedPoint : !!newLabel.trim()

  function resolvePendingPoint(): AddedPoint | null {
    const point: SelectedPoint | null = usingRoute
      ? selectedPoint
      : newLabel.trim()
        ? { routePointId: null, label: newLabel.trim(), lat: newLat, lng: newLng }
        : null
    if (!point) return null
    return { ...point, timeStart, timeEnd }
  }

  function handleAdd() {
    const point = resolvePendingPoint()
    if (!point) {
      push({ type: 'error', title: 'Elige o crea un punto primero' })
      return
    }
    onAdd(point)
    resetPointForm()
    setPointFormOpen(!usingRoute)
  }

  useImperativeHandle(ref, () => ({
    commitPending: () => {
      const point = resolvePendingPoint()
      if (!point) return null
      resetPointForm()
      setPointFormOpen(!usingRoute)
      return point
    },
  }))

  return (
    <div className="border border-border p-5">
      {showRouteSelector && (
        <Select label="Ruta" value={routeId} onChange={(e) => handleRouteChange(e.target.value)}>
          <option value="">Sin ruta</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </Select>
      )}

      {usingRoute && (
        <div className="mt-4">
          <Select label="Punto en esta ruta" value={selectedPoint?.routePointId ?? (pointFormOpen ? NEW_POINT : '')} onChange={(e) => handlePointChange(e.target.value)}>
            <option value="">Selecciona un punto</option>
            {routePoints.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
            <option value={NEW_POINT}>+ Nuevo punto en esta ruta</option>
          </Select>
        </div>
      )}

      {pointFormOpen && (
        <div className="mt-4">
          <p className="mb-3 font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground">
            Haz clic en el mapa para marcar el punto
          </p>
          <MapPointPicker lat={newLat} lng={newLng} onPick={(lat, lng) => { setNewLat(lat); setNewLng(lng) }} />
          <div className="mt-4 flex items-end gap-3">
            <div className="flex-1">
              <Input label="Nombre del punto" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Ej. VP Racing" />
            </div>
            {usingRoute && (
              <Button variant="ghost" loading={savingPoint} onClick={handleCreatePoint}>Crear punto</Button>
            )}
          </div>
        </div>
      )}

      {selectedPoint && !pointFormOpen && (
        <div className="mt-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Punto: <span className="font-semibold text-foreground">{selectedPoint.label}</span>{' '}
            <button onClick={() => { setPointFormOpen(true); setSelectedPoint(null) }} className="text-accent underline">Cambiar</button>
          </p>
          <MapPointPicker lat={selectedPoint.lat} lng={selectedPoint.lng} readOnly />
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Input label="Hora inicio" type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} />
        <Input label="Hora fin" type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} />
      </div>
      <Button
        className="mt-4 w-full justify-center py-4 text-sm"
        onClick={handleAdd}
        disabled={!readyToTime}
      >
        ✓ Agregar este punto a la lista
      </Button>
      {readyToTime && (
        <p className="mt-2 text-center text-xs text-accent">
          No olvides hacer clic arriba — si guardas el evento sin agregarlo, lo agregamos automáticamente por ti.
        </p>
      )}
    </div>
  )
})
