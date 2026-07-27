import type { LatLng } from '../types/route'
import { distanceToPathMeters } from './geo'
import { boundingBoxFromCenter, fetchOverpassJson } from './overpass'

export interface OverpassNode {
  lat: number
  lon: number
  tags?: Record<string, string>
}

/** Fetches traffic-signal and crossing nodes once for a bounding circle.
 * Throws if the query fails after its retry - callers decide how to degrade
 * (route generation shouldn't hard-fail on this). */
export async function fetchNearbyTrafficNodes(
  center: LatLng,
  radiusMeters: number,
): Promise<{ signalNodes: OverpassNode[]; crossingNodes: OverpassNode[] }> {
  const { south, west, north, east } = boundingBoxFromCenter(center, radiusMeters)
  const query = `[out:json][timeout:25];(node["highway"~"^(traffic_signals|crossing)$"](${south},${west},${north},${east}););out body;`

  const data = await fetchOverpassJson<OverpassNode>(query)

  const signalNodes = data.elements.filter((n) => n.tags?.highway === 'traffic_signals')
  const crossingNodes = data.elements.filter((n) => n.tags?.highway === 'crossing')
  return { signalNodes, crossingNodes }
}

const NEAR_PATH_THRESHOLD_METERS = 15

export function countNodesNearPath(nodes: OverpassNode[], path: LatLng[]): number {
  return nodes.filter(
    (node) => distanceToPathMeters({ lat: node.lat, lng: node.lon }, path) <= NEAR_PATH_THRESHOLD_METERS,
  ).length
}
