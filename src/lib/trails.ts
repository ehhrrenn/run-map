import type { LatLng } from '../types/route'
import { nearestPointOnPath } from './geo'
import { boundingBoxFromCenter, fetchOverpassJson } from './overpass'

const PEDESTRIAN_HIGHWAY_VALUES = 'footway|path|pedestrian|cycleway|track'
const SNAP_MAX_DISTANCE_METERS = 250

interface OverpassWay {
  type: string
  geometry?: { lat: number; lon: number }[]
}

export interface PedestrianTrail {
  path: LatLng[]
}

/** Fetches nearby pedestrian-oriented ways (footways, paths, cycleways -
 * places without vehicle traffic and so no traffic signals or crossings). */
export async function fetchNearbyPedestrianTrails(
  center: LatLng,
  radiusMeters: number,
): Promise<PedestrianTrail[]> {
  const { south, west, north, east } = boundingBoxFromCenter(center, radiusMeters)
  const query = `[out:json][timeout:25];way["highway"~"^(${PEDESTRIAN_HIGHWAY_VALUES})$"]["foot"!="no"](${south},${west},${north},${east});out geom;`

  const data = await fetchOverpassJson<OverpassWay>(query)

  return data.elements
    .filter((el) => el.type === 'way' && el.geometry && el.geometry.length > 1)
    .map((way) => ({ path: way.geometry!.map((p) => ({ lat: p.lat, lng: p.lon })) }))
}

/** Snaps a point onto the nearest nearby pedestrian trail, if one is close
 * enough to plausibly be "the same spot" - otherwise returns the point
 * unchanged. Used to bias generated loops onto car-free paths. */
export function snapToNearestTrail(point: LatLng, trails: PedestrianTrail[]): LatLng {
  let best: { point: LatLng; distanceMeters: number } | null = null
  for (const trail of trails) {
    const candidate = nearestPointOnPath(point, trail.path)
    if (!best || candidate.distanceMeters < best.distanceMeters) best = candidate
  }
  return best && best.distanceMeters <= SNAP_MAX_DISTANCE_METERS ? best.point : point
}
