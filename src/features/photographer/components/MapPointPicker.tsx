import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { cn } from '../../../lib/cn'

const ACCENT_ICON = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;border-radius:9999px;background:#FF3D00;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

const OTHER_ICON = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:9999px;background:#111;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

const STREET_TILE = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}
const SATELLITE_TILE = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Tiles &copy; Esri',
}

function ClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/** Recentra el mapa cuando cambian lat/lng/zoom — pero solo se monta cuando
 * el llamador realmente quiere ese comportamiento (elegir un punto ya
 * existente). Si siempre estuviera montado, cada clic para marcar un punto
 * NUEVO recentraría el mapa justo debajo del cursor, sin dejar al
 * fotógrafo alejarse/paneear libremente para ubicar el punto con calma. */
function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], zoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, zoom])
  return null
}

export interface MapMarkerInfo {
  id: string
  label: string
  lat: number
  lng: number
}

interface MapPointPickerProps {
  lat: number
  lng: number
  onPick?: (lat: number, lng: number) => void
  /** Recentra el mapa cada vez que lat/lng cambian (ej. al elegir otro punto
   * existente en el selector) — para "punto nuevo" debe ir en false, así el
   * fotógrafo puede paneear/zoom libremente sin que el clic lo recentre. */
  autoRecenter?: boolean
  heightClassName?: string
  zoom?: number
  /** Otros puntos ya guardados de la ruta — se muestran como marcadores
   * secundarios con tooltip al pasar el cursor (nombre + ubicación). */
  markers?: MapMarkerInfo[]
  onMarkerClick?: (id: string) => void
}

export function MapPointPicker({ lat, lng, onPick, autoRecenter = false, heightClassName = 'h-64', zoom = 12, markers = [], onMarkerClick }: MapPointPickerProps) {
  const [satellite, setSatellite] = useState(false)
  const initialCenter = useRef<[number, number]>([lat, lng])
  const tile = satellite ? SATELLITE_TILE : STREET_TILE

  return (
    // `isolate`: los panes internos de Leaflet usan z-index altos (hasta
    // ~700) que, sin una capa de aislamiento propia, competían con el
    // footer sticky, el modal de "salir sin guardar", etc. — quedando el
    // mapa arriba de todo eso por error.
    <div className={cn('relative isolate w-full overflow-hidden rounded-2xl border border-border', heightClassName)}>
      <button
        type="button"
        onClick={() => setSatellite((s) => !s)}
        className="absolute right-2 top-2 z-[1000] rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-black/85"
      >
        {satellite ? 'Ver mapa' : 'Ver satélite'}
      </button>
      <MapContainer
        center={initialCenter.current}
        zoom={zoom}
        scrollWheelZoom
        dragging
        zoomControl
        doubleClickZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer attribution={tile.attribution} url={tile.url} />
        {autoRecenter && <Recenter lat={lat} lng={lng} zoom={zoom} />}
        {onPick && <ClickCatcher onPick={onPick} />}
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={OTHER_ICON}
            eventHandlers={onMarkerClick ? { click: () => onMarkerClick(m.id) } : undefined}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <span className="font-semibold">{m.label}</span>
            </Tooltip>
          </Marker>
        ))}
        <Marker position={[lat, lng]} icon={ACCENT_ICON} />
      </MapContainer>
    </div>
  )
}
