import type { LatLng } from '../types/route'
import { destinationPoint } from './geo'

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const FETCH_TIMEOUT_MS = 12000
const RETRY_DELAY_MS = 1500

export function boundingBoxFromCenter(center: LatLng, radiusMeters: number) {
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

async function fetchOnce<T>(query: string): Promise<{ elements: T[] }> {
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
    return (await response.json()) as { elements: T[] }
  } finally {
    clearTimeout(timer)
  }
}

/** Runs an Overpass QL query with one retry on failure/timeout. */
export async function fetchOverpassJson<T>(query: string): Promise<{ elements: T[] }> {
  try {
    return await fetchOnce<T>(query)
  } catch {
    await sleep(RETRY_DELAY_MS)
    return await fetchOnce<T>(query)
  }
}
