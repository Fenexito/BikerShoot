import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useRoutePoints, createRoutePoint } from '../../shared/useRoutes'
import { MapPointPicker } from './MapPointPicker'
import { TimePicker } from '../../../ui/shared/TimePicker'
import { FancySelect } from '../../../ui/shared/FancySelect'
import { Button } from '../../../ui/studio/Button'
import { useToastStore } from '../../../ui/overlays/toastStore'
import { haversineMeters, DUPLICATE_POINT_THRESHOLD_M } from '../../../lib/geo'
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
  /** Puntos que el fotógrafo ya agregó a ESTE evento — se usan para (a) no
   * ofrecer un punto que ya está en la lista como "existente" otra vez, y
   * (b) bloquear un punto nuevo cuyas coordenadas caen encima de uno que ya
   * agregó (con nombre distinto o no). */
  addedPoints?: { routePointId: string | null; lat: number; lng: number; label: string }[]
}

const smallInputClass =
  'h-12 w-full rounded-full border border-border bg-input px-4 text-sm text-foreground outline-none transition-colors duration-150 focus:border-accent'

/** Dos modos EXPLÍCITOS en vez de un selector con una opción "+ Nuevo punto"
 * mezclada entre los reales — esa mezcla es justo lo que resultaba confuso.
 * "Punto existente" solo aparece si la ruta ya tiene puntos guardados, y es
 * el modo por defecto (es el caso más común: reutilizar un punto ya usado). */
export const RoutePointPicker = forwardRef<RoutePointPickerHandle, RoutePointPickerProps>(function RoutePointPicker(
  { onAdd, useRoute = false, routeId = '', addedPoints = [] },
  ref,
) {
  const push = useToastStore((s) => s.push)
  const { data: allRoutePoints = [] } = useRoutePoints(routeId || undefined)
  // Ya agregado a este evento → no debe ofrecerse de nuevo como "existente".
  // Por coordenadas, no solo por id: un punto agregado sin pasar por
  // "Guardar en la ruta" (routePointId null) puede coincidir físicamente con
  // una entrada del catálogo de la ruta creada por otro fotógrafo con otro
  // nombre — el id no lo detecta, la distancia sí.
  const routePoints = allRoutePoints.filter(
    (p) => !addedPoints.some((added) => haversineMeters(p.lat, p.lng, added.lat, added.lng) <= DUPLICATE_POINT_THRESHOLD_M),
  )

  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newLat, setNewLat] = useState(GUATEMALA_CENTER.lat)
  const [newLng, setNewLng] = useState(GUATEMALA_CENTER.lng)
  const [savingPoint, setSavingPoint] = useState(false)
  const lastRouteId = useRef(routeId)

  const [timeStart, setTimeStart] = useState('05:00')
  const [timeEnd, setTimeEnd] = useState('05:30')

  // Si la hora inicio avanza más allá de la hora fin ya elegida, esta deja
  // de tener sentido — se empuja 15 min después de la nueva hora inicio en
  // vez de dejar una combinación inválida (fin <= inicio) seleccionada.
  useEffect(() => {
    if (timeEnd <= timeStart) {
      const [h, m] = timeStart.split(':').map(Number)
      const total = (h * 60 + m + 15) % (24 * 60)
      setTimeEnd(`${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeStart])

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

  /** Busca un punto (de la ruta completa o ya agregado a este evento) que
   * físicamente sea el mismo lugar — aunque el nombre no coincida. */
  function findDuplicate(lat: number, lng: number): string | null {
    const candidates = [
      ...allRoutePoints.map((p) => ({ label: p.label, lat: p.lat, lng: p.lng })),
      ...addedPoints,
    ]
    for (const c of candidates) {
      if (haversineMeters(lat, lng, c.lat, c.lng) <= DUPLICATE_POINT_THRESHOLD_M) return c.label
    }
    return null
  }

  async function handleCreatePoint() {
    if (!newLabel.trim()) {
      push({ type: 'error', title: 'Ponle un nombre al punto' })
      return
    }
    const dup = findDuplicate(newLat, newLng)
    if (dup) {
      push({ type: 'error', title: 'Ya existe un punto ahí', description: `"${dup}" está a menos de ${DUPLICATE_POINT_THRESHOLD_M}m — es el mismo lugar.` })
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
    if (effectiveMode === 'new') {
      const dup = findDuplicate(point.lat, point.lng)
      if (dup) {
        push({ type: 'error', title: 'Ya existe un punto ahí', description: `"${dup}" está a menos de ${DUPLICATE_POINT_THRESHOLD_M}m — es el mismo lugar.` })
        return
      }
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
          <TimePicker label="Hora fin" value={timeEnd} onChange={setTimeEnd} after={timeStart} />
        </div>

        <Button variant="dark" className="w-full justify-center py-4 text-sm" onClick={handleAdd} disabled={!readyToTime}>
          ✓ Agregar este punto a la lista
        </Button>
      </div>

      {/* El mapa va a la derecha una vez hay ruta elegida — es lo que el
          fotógrafo mira más tiempo al ubicar o confirmar un punto. Siempre
          se puede paneear/zoom con el cursor; solo se recentra solo al
          elegir un punto existente, nunca al marcar uno nuevo. */}
      <div className="lg:order-2 lg:col-span-2">
        <MapPointPicker
          lat={mapLat}
          lng={mapLng}
          zoom={mapZoom}
          autoRecenter={effectiveMode === 'existing'}
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
