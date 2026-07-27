import { APIProvider, Map, Marker, Polyline } from '@vis.gl/react-google-maps'
import { GOOGLE_MAPS_API_KEY } from '../config/env'
import type { LatLng } from '../types/route'

interface MapViewProps {
  start: LatLng | null
  path: LatLng[]
  onMapClick: (point: LatLng) => void
}

const DEFAULT_CENTER: LatLng = { lat: 40.7128, lng: -74.006 }

export function MapView({ start, path, onMapClick }: MapViewProps) {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <Map
        className="map-view"
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={14}
        gestureHandling="greedy"
        disableDefaultUI={false}
        onClick={(e) => {
          if (e.detail.latLng) onMapClick(e.detail.latLng)
        }}
      >
        {start && <Marker position={start} />}
        {path.length > 0 && <Polyline path={path} />}
      </Map>
    </APIProvider>
  )
}
