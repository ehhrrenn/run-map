import type { LatLng } from '../types/route'

const EARTH_RADIUS_METERS = 6371000

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

function toDeg(rad: number) {
  return (rad * 180) / Math.PI
}

export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h))
}

/** Point at the given bearing (degrees from north) and distance (meters) from origin. */
export function destinationPoint(origin: LatLng, bearingDeg: number, distanceMeters: number): LatLng {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS
  const bearing = toRad(bearingDeg)
  const lat1 = toRad(origin.lat)
  const lng1 = toRad(origin.lng)

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  )
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    )

  return { lat: toDeg(lat2), lng: toDeg(lng2) }
}

export function bearingDegBetween(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const dLng = toRad(b.lng - a.lng)

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)

  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

/** Smallest angle between two bearings, in [0, 180] degrees. */
export function angularDiffDeg(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

interface NearestPointResult {
  point: LatLng
  distanceMeters: number
}

/** Nearest point on a segment to the given point, using a flat-earth
 * approximation local to the segment (fine at street scale). */
export function nearestPointOnSegment(point: LatLng, a: LatLng, b: LatLng): NearestPointResult {
  const latRef = toRad(a.lat)
  const metersPerDegLat = 111320
  const metersPerDegLng = 111320 * Math.cos(latRef)

  const toXY = (p: LatLng) => ({
    x: (p.lng - a.lng) * metersPerDegLng,
    y: (p.lat - a.lat) * metersPerDegLat,
  })
  const fromXY = (xy: { x: number; y: number }): LatLng => ({
    lat: a.lat + xy.y / metersPerDegLat,
    lng: a.lng + xy.x / metersPerDegLng,
  })

  const p = toXY(point)
  const bXY = toXY(b)

  const segLengthSq = bXY.x ** 2 + bXY.y ** 2
  if (segLengthSq === 0) return { point: a, distanceMeters: Math.hypot(p.x, p.y) }

  const t = Math.max(0, Math.min(1, (p.x * bXY.x + p.y * bXY.y) / segLengthSq))
  const proj = { x: t * bXY.x, y: t * bXY.y }

  return { point: fromXY(proj), distanceMeters: Math.hypot(p.x - proj.x, p.y - proj.y) }
}

export function distanceToSegmentMeters(point: LatLng, a: LatLng, b: LatLng): number {
  return nearestPointOnSegment(point, a, b).distanceMeters
}

export function nearestPointOnPath(point: LatLng, path: LatLng[]): NearestPointResult {
  let best: NearestPointResult = { point: path[0], distanceMeters: Infinity }
  for (let i = 1; i < path.length; i++) {
    const candidate = nearestPointOnSegment(point, path[i - 1], path[i])
    if (candidate.distanceMeters < best.distanceMeters) best = candidate
  }
  return best
}

export function distanceToPathMeters(point: LatLng, path: LatLng[]): number {
  return nearestPointOnPath(point, path).distanceMeters
}
