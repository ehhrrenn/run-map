export interface LatLng {
  lat: number
  lng: number
}

export type RoutePriority = 'traffic' | 'elevation' | 'turns'

export interface RouteRequest {
  start: LatLng
  distanceMeters: number
  maxElevationGainMeters: number
  routePriority: RoutePriority
  requiredStops: LatLng[]
}

export interface GeneratedRoute {
  path: LatLng[]
  waypoints: LatLng[]
  distanceMeters: number
  elevationGainMeters: number
  trafficSignalCount: number
  crossingCount: number
  turnCount: number
}

export interface SavedRoute extends GeneratedRoute {
  id: string
  name: string
  start: LatLng
  requiredStops: LatLng[]
  createdAt: number
}
