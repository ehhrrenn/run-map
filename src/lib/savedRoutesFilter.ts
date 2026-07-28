import type { SavedRoute } from '../types/route'

export interface SavedRoutesFilter {
  nameQuery: string
  minDistanceMeters: number | null
  maxDistanceMeters: number | null
}

export function filterSavedRoutes(routes: SavedRoute[], filter: SavedRoutesFilter): SavedRoute[] {
  const query = filter.nameQuery.trim().toLowerCase()
  return routes.filter((route) => {
    if (query && !route.name.toLowerCase().includes(query)) return false
    if (filter.minDistanceMeters !== null && route.distanceMeters < filter.minDistanceMeters) return false
    if (filter.maxDistanceMeters !== null && route.distanceMeters > filter.maxDistanceMeters) return false
    return true
  })
}
