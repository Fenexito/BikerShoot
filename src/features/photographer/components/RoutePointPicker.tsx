import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useRoutePoints, createRoutePoint } from '../../shared/useRoutes'
import { MapPointPicker } from './MapPointPicker'
import { TimePicker } from '../../../ui/shared/TimePicker'
import { FancySelect } from '../../../ui/shared/FancySelect'
import { Button } from '../../../ui/studio/Button'
import { useToastStore } from '../../../ui/overlays/toastStore'
import { cn } from '../../../lib/cn'

const GUATEMALA_CENTER = { lat: 14.6349, lng: -90.5069 }
const BASE_ZOOM = 12
const EXISTING_ZOOM = BASE_ZOOM + 4
const NEW_ZOOM = BASE_ZOOM + 2

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
  /** Rodadas anclan el punto a la ruta elegida arriba en el formulario (una sola
   * vez por evento, no por punto); pista/sesión de fotos siempre son puntos sueltos. */
  useRoute?: boolean
  routeId?: string
}

const smallInputClass =
  'h-12 w-full rounded-full border border-border bg-input px-4 text-sm text-foreground outline-none transition-colors duration-150 focus:border-accent'

/** Dos modos EXPLÍCITOS en vez de un selector con una opción "+ Nuevo punto"
 * mezclada entre los reales — esa mezcla es justo lo que resultaba confuso.
 * "Punto existente" solo aparece si la ruta ya tiene puntos guardados, y es
 * el modo por defecto (es el caso más común: reutilizar un punto ya usado). */
export const RoutePointPicker = forwardRef<RoutePointPickerHandle, RoutePointPickerProps>(function RoutePointPicker(
  { onAdd, useRoute = false, routeId = '' },
  ref,
) {
  const push = useToastStore((s) => s.push)
  const { data: routePoints = [] } = useRoutePoints(routeId || undefined)

  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newLat, setNewLat] = useState(GUATEMALA_CENTER.lat)
  const [newLng, setNewLng] = useState(GUATEMALA_CENTER.lng)
  const [savingPoint, setSavingPoint] = useState(false)
  const lastRouteId = useRef(routeId)

  const [timeStart, setTimeStart] = useState('05:00')
  const [timeEnd, setTimeEnd] = useState('05:30')

  const usingRoute = useRoute && !!routeId
  // Aunque el estado interno recuerde "existente", si la ruta todavía no
  // tiene ningún punto guardado no hay nada que elegir — se comporta como
  // "nuevo" sin necesidad de forzar el estado (así, en cuanto se guarde el
  // primer punto, vuelve a ofrecer "existente" por defecto la próxima vez).
  const effectiveMode: 'existing' | 'new' = usingRoute && routePoints.length > 0 ? mode : 'new'

  function resetPointForm() {
    setSelectedPoint(null)
    setNewLabel('')
    setNewLat(GUATEMALA_CENTER.lat)
    setNewLng(GUATEMALA_CENTER.lng)
  }

  // Si el fotógrafo cambia la ruta arriba, el punto que tenía a medio elegir
  // ya no tiene sentido (pertenecía a la ruta anterior) — vuelve a "existente"
  // por defecto para la ruta nueva.
  useEffect(() => {
    if (lastRouteId.current === routeId) return
    lastRouteId.current = routeId
    resetPointForm()
    setMode('existing')
  }, [routeId])

  function handleSelectExisting(value: string) {
    const found = routePoints.find((p) => p.id === value)
    if (found) setSelectedPoint({ routePointId: found.id, label: found.label, lat: found.lat, lng: found.lng })
  }

  async function handleCreatePoint() {
    if (!newLabel.trim()) {
      push({ type: 'error', title: 'Ponle un nombre al punto' })
      return
    }
    setSavingPoint(true)
    try {
      const point = await createRoutePoint(routeId, newLabel.trim(), newLat, newLng)
      push({ type: 'success', title: 'Punto guardado en la ruta' })
      setSelectedPoint({ routePointId: point.id, label: point.label, lat: point.lat, lng: point.lng })
      setMode('existing')
      setNewLabel('')
    } catch (err) {
      push({ type: 'error', title: 'No se pudo crear el punto', description: (err as Error).message })
    } finally {
      setSavingPoint(false)
    }
  }

  const readyToTime = usingRoute ? (effectiveMode === 'existing' ? !!selectedPoint : !!newLabel.trim()) : !!newLabel.trim()

  function resolvePendingPoint(): AddedPoint | null {
    const point: SelectedPoint | null =
      usingRoute && effectiveMode === 'existing'
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
    setMode('existing')
  }

  useImperativeHandle(ref, () => ({
    commitPending: () => {
      const point = resolvePendingPoint()
      if (!point) return null
      resetPointForm()
      setMode('existing')
      return point
    },
  }))

  if (useRoute && !routeId) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Elige una ruta arriba para poder agregar puntos.
      </div>
    )
  }

  const mapLat = effectiveMode === 'existing' && selectedPoint ? selectedPoint.lat : newLat
  const mapLng = effectiveMode === 'existing' && selectedPoint ? selectedPoint.lng : newLng
  const mapReadOnly = effectiveMode === 'existing'
  const mapZoom = effectiveMode === 'existing' ? EXISTING_ZOOM : NEW_ZOOM

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:order-1 lg:col-span-1">
        {usingRoute && routePoints.length > 0 && (
          <div className="flex gap-1 rounded-full bg-muted p-1">
            <button
              onClick={() => setMode('existing')}
              className={cn(
                'flex-1 rounded-full px-3 py-2 text-xs font-semibold transition-colors',
                effectiveMode === 'existing' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Punto existente
            </button>
            <button
              onClick={() => { setMode('new'); setSelectedPoint(null) }}
              className={cn(
                'flex-1 rounded-full px-3 py-2 text-xs font-semibold transition-colors',
                effectiveMode === 'new' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Punto nuevo
            </button>
          </div>
        )}

        {usingRoute && effectiveMode === 'existing' ? (
          <FancySelect
            label="Punto en esta ruta"
            value={selectedPoint?.routePointId ?? ''}
            onChange={handleSelectExisting}
            options={routePoints.map((p) => ({ value: p.id, label: p.label }))}
            placeholder="Selecciona un punto"
          />
        ) : (
          <div className="flex items-end gap-3">
            <div className="flex-1 flex-col gap-1.5">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Nombre del punto</span>
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Ej. VP Racing" className={smallInputClass} />
            </div>
            {usingRoute && (
              <Button variant="secondary" size="sm" loading={savingPoint} onClick={handleCreatePoint}>
                Guardar
              </Button>
            )}
          </div>
        )}
        {usingRoute && effectiveMode === 'new' && (
          <p className="-mt-2 text-xs text-muted-foreground">
            "Guardar" lo deja disponible para elegir en futuros eventos de esta misma ruta.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <TimePicker label="Hora inicio" value={timeStart} onChange={setTimeStart} />
          <TimePicker label="Hora fin" value={timeEnd} onChange={setTimeEnd} />
        </div>

        <Button variant="dark" className="w-full justify-center py-4 text-sm" onClick={handleAdd} disabled={!readyToTime}>
          ✓ Agregar este punto a la lista
        </Button>
      </div>

      {/* El mapa va a la derecha una vez hay ruta elegida — es lo que el
          fotógrafo mira más tiempo al ubicar o confirmar un punto. */}
      <div className="lg:order-2 lg:col-span-2">
        <MapPointPicker
          lat={mapLat}
          lng={mapLng}
          zoom={mapZoom}
          readOnly={mapReadOnly}
          onPick={effectiveMode === 'new' ? (lat, lng) => { setNewLat(lat); setNewLng(lng) } : undefined}
          heightClassName="h-72 lg:h-[420px]"
          markers={usingRoute ? routePoints.map((p) => ({ id: p.id, label: p.label, lat: p.lat, lng: p.lng })) : []}
          onMarkerClick={
            usingRoute
              ? (id) => {
                  const found = routePoints.find((p) => p.id === id)
                  if (found) {
                    setMode('existing')
                    setSelectedPoint({ routePointId: found.id, label: found.label, lat: found.lat, lng: found.lng })
                  }
                }
              : undefined
          }
        />
        {effectiveMode === 'new' && (
          <p className="mt-2 text-xs text-muted-foreground">Haz clic en el mapa para marcar dónde está este punto.</p>
        )}
      </div>
    </div>
  )
})
