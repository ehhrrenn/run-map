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

/** Shortest distance in meters from a point to a segment, using a flat-earth
 * approximation local to the segment (fine at street scale). */
export function distanceToSegmentMeters(point: LatLng, a: LatLng, b: LatLng): number {
  const latRef = toRad(a.lat)
  const metersPerDegLat = 111320
  const metersPerDegLng = 111320 * Math.cos(latRef)

  const toXY = (p: LatLng) => ({
    x: (p.lng - a.lng) * metersPerDegLng,
    y: (p.lat - a.lat) * metersPerDegLat,
  })

  const p = toXY(point)
  const bXY = toXY(b)

  const segLengthSq = bXY.x ** 2 + bXY.y ** 2
  if (segLengthSq === 0) return Math.hypot(p.x, p.y)

  const t = Math.max(0, Math.min(1, (p.x * bXY.x + p.y * bXY.y) / segLengthSq))
  const projX = t * bXY.x
  const projY = t * bXY.y

  return Math.hypot(p.x - projX, p.y - projY)
}

export function distanceToPathMeters(point: LatLng, path: LatLng[]): number {
  let min = Infinity
  for (let i = 1; i < path.length; i++) {
    min = Math.min(min, distanceToSegmentMeters(point, path[i - 1], path[i]))
  }
  return min
}
