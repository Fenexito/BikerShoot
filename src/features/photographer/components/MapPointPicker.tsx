import { useEffect, useState } from 'react'
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

/** Recentra el mapa cuando cambian lat/lng/zoom desde fuera (ej. al elegir
 * otro punto existente) — MapContainer solo usa center/zoom como valor
 * INICIAL, no los vuelve a aplicar solo. */
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
  readOnly?: boolean
  heightClassName?: string
  zoom?: number
  /** Otros puntos ya guardados de la ruta — se muestran como marcadores
   * secundarios con tooltip al pasar el cursor (nombre + ubicación). */
  markers?: MapMarkerInfo[]
  onMarkerClick?: (id: string) => void
}

export function MapPointPicker({ lat, lng, onPick, readOnly, heightClassName = 'h-64', zoom = 12, markers = [], onMarkerClick }: MapPointPickerProps) {
  const [satellite, setSatellite] = useState(false)
  const tile = satellite ? SATELLITE_TILE : STREET_TILE

  return (
    <div className={cn('relative w-full overflow-hidden rounded-2xl border border-border', heightClassName)}>
      <button
        type="button"
        onClick={() => setSatellite((s) => !s)}
        className="absolute right-2 top-2 z-[1000] rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-black/85"
      >
        {satellite ? 'Ver mapa' : 'Ver satélite'}
      </button>
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        scrollWheelZoom={!readOnly}
        dragging={!readOnly}
        zoomControl={!readOnly}
        doubleClickZoom={!readOnly}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer attribution={tile.attribution} url={tile.url} />
        <Recenter lat={lat} lng={lng} zoom={zoom} />
        {!readOnly && onPick && <ClickCatcher onPick={onPick} />}
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
