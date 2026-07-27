import type { LatLng } from '../types/route'
import { haversineDistanceMeters } from './geo'

function coord(point: LatLng): string {
  return `${point.lat},${point.lng}`
}

/** Google's Maps URL API supports at most 3 waypoints when the link opens in
 * a mobile browser (9 on desktop) - our routes always carry exactly 3, so
 * this stays within the tighter mobile limit. */
export function googleMapsWalkingUrl(start: LatLng, waypoints: LatLng[]): string {
  const params = new URLSearchParams({
    api: '1',
    origin: coord(start),
    destination: coord(start),
    travelmode: 'walking',
  })
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map(coord).join('|'))
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/** Apple Maps' documented URL scheme only supports a single origin/destination
 * pair - there's no official multi-stop syntax to chain our loop's waypoints.
 * As a fallback, link to the waypoint farthest from the start (the loop's
 * turnaround point) for one meaningful walking leg rather than a degenerate
 * zero-length start-to-start link. */
export function appleMapsWalkingUrl(start: LatLng, waypoints: LatLng[]): string {
  const destination =
    waypoints.length > 0
      ? waypoints.reduce((farthest, point) =>
          haversineDistanceMeters(start, point) > haversineDistanceMeters(start, farthest)
            ? point
            : farthest,
        )
      : start

  const params = new URLSearchParams({
    saddr: coord(start),
    daddr: coord(destination),
    dirflg: 'w',
  })
  return `https://maps.apple.com/?${params.toString()}`
}
