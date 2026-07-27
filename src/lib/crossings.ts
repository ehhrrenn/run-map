import type { LatLng } from '../types/route'
import { destinationPoint, distanceToPathMeters } from './geo'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const FETCH_TIMEOUT_MS = 12000
const RETRY_DELAY_MS = 1500

export interface OverpassNode {
  lat: number
  lon: number
  tags?: Record<string, string>
}

function boundingBox(center: LatLng, radiusMeters: number) {
  return {
    north: destinationPoint(center, 0, radiusMeters).lat,
    east: destinationPoint(center, 90, radiusMeters).lng,
    south: destinationPoint(center, 180, radiusMeters).lat,
    west: destinationPoint(center, 270, radiusMeters).lng,
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchOnce(query: string): Promise<{ elements: OverpassNode[] }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: query,
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`Overpass query failed: ${response.status}`)
    }
    return (await response.json()) as { elements: OverpassNode[] }
  } finally {
    clearTimeout(timer)
  }
}

/** Fetches traffic-signal and crossing nodes once for a bounding circle,
 * with one retry on failure/timeout. Throws if both attempts fail - callers
 * decide how to degrade (route generation shouldn't hard-fail on this). */
export async function fetchNearbyTrafficNodes(
  center: LatLng,
  radiusMeters: number,
): Promise<{ signalNodes: OverpassNode[]; crossingNodes: OverpassNode[] }> {
  const { south, west, north, east } = boundingBox(center, radiusMeters)
  const query = `[out:json][timeout:25];(node["highway"~"^(traffic_signals|crossing)$"](${south},${west},${north},${east}););out body;`

  let data: { elements: OverpassNode[] }
  try {
    data = await fetchOnce(query)
  } catch {
    await sleep(RETRY_DELAY_MS)
    data = await fetchOnce(query)
  }

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
