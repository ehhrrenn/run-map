import type { LatLng } from '../types/route'
import { distanceToPathMeters } from './geo'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const NEAR_PATH_THRESHOLD_METERS = 15
const BBOX_PADDING_DEG = 0.002

interface OverpassNode {
  lat: number
  lon: number
  tags?: Record<string, string>
}

function boundingBox(path: LatLng[]) {
  const lats = path.map((p) => p.lat)
  const lngs = path.map((p) => p.lng)
  return {
    south: Math.min(...lats) - BBOX_PADDING_DEG,
    west: Math.min(...lngs) - BBOX_PADDING_DEG,
    north: Math.max(...lats) + BBOX_PADDING_DEG,
    east: Math.max(...lngs) + BBOX_PADDING_DEG,
  }
}

async function queryOverpassNodes(path: LatLng[], highwayValue: string): Promise<OverpassNode[]> {
  const { south, west, north, east } = boundingBox(path)
  const query = `[out:json][timeout:25];node["highway"="${highwayValue}"](${south},${west},${north},${east});out body;`

  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: query,
  })
  if (!response.ok) {
    throw new Error(`Overpass query failed: ${response.status}`)
  }
  const data = (await response.json()) as { elements: OverpassNode[] }
  return data.elements
}

function countNodesNearPath(nodes: OverpassNode[], path: LatLng[]): number {
  return nodes.filter(
    (node) => distanceToPathMeters({ lat: node.lat, lng: node.lon }, path) <= NEAR_PATH_THRESHOLD_METERS,
  ).length
}

export async function countTrafficSignalsAndCrossings(
  path: LatLng[],
): Promise<{ trafficSignalCount: number; crossingCount: number }> {
  const [signalNodes, crossingNodes] = await Promise.all([
    queryOverpassNodes(path, 'traffic_signals'),
    queryOverpassNodes(path, 'crossing'),
  ])

  return {
    trafficSignalCount: countNodesNearPath(signalNodes, path),
    crossingCount: countNodesNearPath(crossingNodes, path),
  }
}
