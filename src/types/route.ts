export interface LatLng {
  lat: number
  lng: number
}

export interface RouteRequest {
  start: LatLng
  distanceMeters: number
  maxElevationGainMeters: number
  avoidTrafficSignals: boolean
}

export interface GeneratedRoute {
  path: LatLng[]
  distanceMeters: number
  elevationGainMeters: number
  trafficSignalCount: number
  crossingCount: number
}
