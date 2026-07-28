export interface LatLng {
  lat: number
  lng: number
}

export interface RouteRequest {
  start: LatLng
  distanceMeters: number
  maxElevationGainMeters: number
  avoidTrafficSignals: boolean
  requiredStops: LatLng[]
}

export interface GeneratedRoute {
  path: LatLng[]
  waypoints: LatLng[]
  distanceMeters: number
  elevationGainMeters: number
  trafficSignalCount: number
  crossingCount: number
}
