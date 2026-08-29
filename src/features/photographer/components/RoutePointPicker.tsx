import { useState } from 'react'
import { useRoutes, useRoutePoints, createRoute, createRoutePoint } from '../../shared/useRoutes'
import { MapPointPicker } from './MapPointPicker'
import { Input } from '../../../ui/studio/Input'
import { Select } from '../../../ui/studio/Select'
import { Button } from '../../../ui/studio/Button'
import { useToastStore } from '../../../ui/overlays/toastStore'

const GUATEMALA_CENTER = { lat: 14.6349, lng: -90.5069 }
const NEW_ROUTE = '__new__'
const NEW_POINT = '__new__'

export interface AddedPoint {
  routePointId: string | null
  label: string
  lat: number
  lng: number
  timeStart: string
  timeEnd: string
}

interface SelectedPoint {
  routePointId: string | null
  label: string
  lat: number
  lng: number
}

export function RoutePointPicker({ onAdd }: { onAdd: (point: AddedPoint) => void }) {
  const push = useToastStore((s) => s.push)
  const { data: routes = [] } = useRoutes()

  const [routeId, setRouteId] = useState('')
  const [creatingRoute, setCreatingRoute] = useState(false)
  const [newRouteName, setNewRouteName] = useState('')
  const [savingRoute, setSavingRoute] = useState(false)

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
    if (value === NEW_ROUTE) {
      setCreatingRoute(true)
      setRouteId('')
    } else {
      setCreatingRoute(false)
      setRouteId(value)
    }
    resetPointForm()
    setPointFormOpen(!value)
  }

  async function handleCreateRoute() {
    if (!newRouteName.trim()) {
      push({ type: 'error', title: 'Ponle un nombre a la ruta' })
      return
    }
    setSavingRoute(true)
    try {
      const route = await createRoute(newRouteName.trim())
      setRouteId(route.id)
      setCreatingRoute(false)
      setNewRouteName('')
      setPointFormOpen(false)
    } catch (err) {
      push({ type: 'error', title: 'No se pudo crear la ruta', description: (err as Error).message })
    } finally {
      setSavingRoute(false)
    }
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

  function handleAdd() {
    const point: SelectedPoint | null = routeId
      ? selectedPoint
      : newLabel.trim()
        ? { routePointId: null, label: newLabel.trim(), lat: newLat, lng: newLng }
        : null

    if (!point) {
      push({ type: 'error', title: 'Elige o crea un punto primero' })
      return
    }

    onAdd({ ...point, timeStart, timeEnd })
    resetPointForm()
    setPointFormOpen(!routeId)
  }

  const readyToTime = routeId ? !!selectedPoint : !!newLabel.trim()

  return (
    <div className="border border-border p-5">
      <Select
        label="Ruta"
        value={creatingRoute ? NEW_ROUTE : routeId}
        onChange={(e) => handleRouteChange(e.target.value)}
      >
        <option value="">Sin ruta (evento único)</option>
        {routes.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
        <option value={NEW_ROUTE}>+ Nueva ruta</option>
      </Select>

      {creatingRoute && (
        <div className="mt-4 flex items-end gap-3">
          <div className="flex-1">
            <Input label="Nombre de la ruta" value={newRouteName} onChange={(e) => setNewRouteName(e.target.value)} placeholder="Ej. Ruta a Tecpan" />
          </div>
          <Button variant="ghost" loading={savingRoute} onClick={handleCreateRoute}>Crear ruta</Button>
        </div>
      )}

      {routeId && !creatingRoute && (
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
            {routeId && (
              <Button variant="ghost" loading={savingPoint} onClick={handleCreatePoint}>Crear punto</Button>
            )}
          </div>
        </div>
      )}

      {selectedPoint && !pointFormOpen && (
        <p className="mt-4 text-sm text-muted-foreground">
          Punto: <span className="font-semibold text-foreground">{selectedPoint.label}</span>{' '}
          <button onClick={() => { setPointFormOpen(true); setSelectedPoint(null) }} className="text-accent underline">Cambiar</button>
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Input label="Hora inicio" type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} />
        <Input label="Hora fin" type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} />
      </div>
      <Button variant="ghost" className="mt-3" onClick={handleAdd} disabled={!readyToTime}>
        + Agregar este punto
      </Button>
    </div>
  )
}
