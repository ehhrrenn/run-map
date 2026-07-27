import { Map, Marker, Polyline } from '@vis.gl/react-google-maps'
import type { LatLng } from '../types/route'

interface MapViewProps {
  start: LatLng | null
  requiredStop: LatLng | null
  path: LatLng[]
  initialCenter: LatLng
  onMapClick: (point: LatLng) => void
}

const REQUIRED_STOP_ICON: google.maps.Icon = {
  url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
}

export function MapView({ start, requiredStop, path, initialCenter, onMapClick }: MapViewProps) {
  return (
    <Map
      className="map-view"
      defaultCenter={initialCenter}
      defaultZoom={14}
      gestureHandling="greedy"
      disableDefaultUI={false}
      onClick={(e) => {
        if (e.detail.latLng) onMapClick(e.detail.latLng)
      }}
    >
      {start && <Marker position={start} />}
      {requiredStop && <Marker position={requiredStop} icon={REQUIRED_STOP_ICON} />}
      {path.length > 0 && <Polyline path={path} />}
    </Map>
  )
}
