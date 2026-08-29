import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useMapPoints, pointMatchesTime } from './usePublicData'
import { useRoutes } from '../shared/useRoutes'
import { Select } from '../../ui/flat/Select'
import { Button } from '../../ui/flat/Button'
import type { MapPoint } from './usePublicData'

const GUATEMALA_CENTER: [number, number] = [14.6349, -90.5069]

const TIME_PRESETS = [
  { label: 'Cualquier hora', after: undefined, before: undefined },
  { label: 'Madrugada (5:00 - 6:00)', after: '05:00', before: '06:00' },
  { label: 'Amanecer (6:00 - 7:00)', after: '06:00', before: '07:00' },
]

function makeIcon(active: boolean) {
  const size = active ? 22 : 16
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:9999px;
      background:${active ? '#3B82F6' : '#9CA3AF'};
      opacity:${active ? 1 : 0.45};
      border:3px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,.35);
      transition:all .2s;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function FlyToPoints({ points }: { points: MapPoint[] }) {
  const map = useMap()
  useMemo(() => {
    if (points.length === 0) return
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]))
    map.flyToBounds(bounds, { padding: [60, 60], duration: 0.6 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.map((p) => p.id).join(',')])
  return null
}

export function RouteMap() {
  const { data: points = [] } = useMapPoints()
  const { data: routes = [] } = useRoutes()
  const [routeId, setRouteId] = useState('')
  const [city, setCity] = useState('')
  const [timePreset, setTimePreset] = useState(0)

  const preset = TIME_PRESETS[timePreset]
  const routeFilteredPoints = routeId ? points.filter((p) => p.route_point?.route_id === routeId) : points
  const cities = useMemo(() => Array.from(new Set(routeFilteredPoints.map((p) => p.event?.city).filter(Boolean))) as string[], [routeFilteredPoints])

  const cityFilteredPoints = city ? routeFilteredPoints.filter((p) => p.event?.city === city) : routeFilteredPoints
  const activePoints = cityFilteredPoints.filter((p) => pointMatchesTime(p, preset.after, preset.before))
  const activeIds = new Set(activePoints.map((p) => p.id))

  return (
    <div className="relative font-flat" style={{ height: 'calc(100vh - 64px)' }}>
      <div className="absolute left-4 right-4 top-4 z-[500] flex flex-wrap items-center gap-3 rounded-lg bg-background/95 p-4 shadow-lg backdrop-blur sm:right-auto sm:w-[420px]">
        <div className="w-full">
          <h1 className="text-lg font-bold tracking-tight">Mapa de puntos</h1>
          <p className="text-sm text-muted-foreground">Encuentra a los fotógrafos por ciudad y horario de salida.</p>
        </div>
        <Select value={routeId} onChange={(e) => { setRouteId(e.target.value); setCity('') }} className="flex-1">
          <option value="">Toda ruta</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </Select>
        <Select value={city} onChange={(e) => setCity(e.target.value)} className="flex-1">
          <option value="">Toda ciudad</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <Select value={timePreset} onChange={(e) => setTimePreset(Number(e.target.value))} className="flex-1">
          {TIME_PRESETS.map((t, i) => (
            <option key={t.label} value={i}>{t.label}</option>
          ))}
        </Select>
        <p className="w-full text-xs font-semibold text-primary">
          {activePoints.length} de {cityFilteredPoints.length} puntos coinciden con tu horario
        </p>
      </div>

      <MapContainer center={GUATEMALA_CENTER} zoom={9} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FlyToPoints points={cityFilteredPoints} />
        {cityFilteredPoints.map((point) => {
          const isActive = activeIds.has(point.id)
          return (
            <Marker key={point.id} position={[point.lat, point.lng]} icon={makeIcon(isActive)}>
              <Popup>
                <div className="w-56 font-flat">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {point.time_start.slice(0, 5)} - {point.time_end.slice(0, 5)}
                  </p>
                  <p className="font-bold">{point.label}</p>
                  <p className="text-sm text-muted-foreground">{point.event?.photographer?.display_name}</p>
                  {point.event && (
                    <Link to={`/app/eventos/${point.event.id}?punto=${point.id}`}>
                      <Button size="sm" className="mt-3 w-full">Ver fotos de este punto</Button>
                    </Link>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
