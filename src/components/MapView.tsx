import { AdvancedMarker, Map, Pin, Polyline } from '@vis.gl/react-google-maps'
import type { LatLng } from '../types/route'
import { GOOGLE_MAPS_MAP_ID } from '../config/env'

interface MapViewProps {
  start: LatLng | null
  requiredStops: LatLng[]
  path: LatLng[]
  initialCenter: LatLng
  onMapClick: (point: LatLng) => void
}

export function MapView({ start, requiredStops, path, initialCenter, onMapClick }: MapViewProps) {
  return (
    <Map
      className="map-view"
      mapId={GOOGLE_MAPS_MAP_ID}
      defaultCenter={initialCenter}
      defaultZoom={14}
      gestureHandling="greedy"
      disableDefaultUI={false}
      onClick={(e) => {
        if (e.detail.latLng) onMapClick(e.detail.latLng)
      }}
    >
      {start && <AdvancedMarker position={start} />}
      {requiredStops.map((stop, index) => (
        <AdvancedMarker key={index} position={stop}>
          <Pin background="#c0392b" borderColor="#962d22" glyphColor="#fff" />
        </AdvancedMarker>
      ))}
      {path.length > 0 && <Polyline path={path} />}
    </Map>
  )
}
