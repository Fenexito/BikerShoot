import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const ACCENT_ICON = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;border-radius:9999px;background:#FF3D00;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

function ClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

interface MapPointPickerProps {
  lat: number
  lng: number
  onPick?: (lat: number, lng: number) => void
  readOnly?: boolean
}

export function MapPointPicker({ lat, lng, onPick, readOnly }: MapPointPickerProps) {
  return (
    <div className="h-64 w-full overflow-hidden border border-border">
      <MapContainer
        center={[lat, lng]}
        zoom={12}
        scrollWheelZoom={!readOnly}
        dragging={!readOnly}
        zoomControl={!readOnly}
        doubleClickZoom={!readOnly}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {!readOnly && onPick && <ClickCatcher onPick={onPick} />}
        <Marker position={[lat, lng]} icon={ACCENT_ICON} />
      </MapContainer>
    </div>
  )
}
