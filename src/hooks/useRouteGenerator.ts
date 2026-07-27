import { useMemo } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import type { GeneratedRoute, LatLng, RouteRequest } from '../types/route'
import { destinationPoint } from '../lib/geo'
import { countTrafficSignalsAndCrossings } from '../lib/crossings'

const CANDIDATE_ROTATIONS_DEG = [0, 60, 120, 180, 240, 300]
// Real streets zigzag relative to a straight loop, so a circle sized exactly
// to the target distance under-shoots once routed onto the road network.
const LOOP_RADIUS_CALIBRATION = 0.72

interface Candidate {
  path: LatLng[]
  distanceMeters: number
  elevationGainMeters: number
  trafficSignalCount: number
  crossingCount: number
}

function loopWaypoints(start: LatLng, radiusMeters: number, rotationDeg: number): LatLng[] {
  return [0, 120, 240].map((offset) => destinationPoint(start, rotationDeg + offset, radiusMeters))
}

function elevationGainMeters(elevations: number[]): number {
  let gain = 0
  for (let i = 1; i < elevations.length; i++) {
    const delta = elevations[i] - elevations[i - 1]
    if (delta > 0) gain += delta
  }
  return gain
}

export function useRouteGenerator() {
  const routesLibrary = useMapsLibrary('routes')
  const elevationLibrary = useMapsLibrary('elevation')

  const directionsService = useMemo(
    () => (routesLibrary ? new routesLibrary.DirectionsService() : null),
    [routesLibrary],
  )
  const elevationService = useMemo(
    () => (elevationLibrary ? new elevationLibrary.ElevationService() : null),
    [elevationLibrary],
  )

  async function routeForWaypoints(start: LatLng, waypoints: LatLng[]) {
    if (!directionsService) throw new Error('Directions service not ready')

    const result = await directionsService.route({
      origin: start,
      destination: start,
      waypoints: waypoints.map((location) => ({ location, stopover: true })),
      travelMode: google.maps.TravelMode.WALKING,
    })

    const route = result.routes[0]
    const distanceMeters = route.legs.reduce((sum, leg) => sum + (leg.distance?.value ?? 0), 0)
    const path = route.overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() }))

    return { path, distanceMeters }
  }

  async function buildCandidate(start: LatLng, radiusMeters: number, rotationDeg: number): Promise<Candidate | null> {
    if (!elevationService) throw new Error('Elevation service not ready')

    try {
      const waypoints = loopWaypoints(start, radiusMeters, rotationDeg)
      const { path, distanceMeters } = await routeForWaypoints(start, waypoints)

      const elevationResult = await elevationService.getElevationAlongPath({
        path,
        samples: 100,
      })
      const gain = elevationGainMeters(elevationResult.results.map((r) => r.elevation))

      const { trafficSignalCount, crossingCount } = await countTrafficSignalsAndCrossings(path)

      return {
        path,
        distanceMeters,
        elevationGainMeters: gain,
        trafficSignalCount,
        crossingCount,
      }
    } catch {
      return null
    }
  }

  async function generateRoute(request: RouteRequest): Promise<GeneratedRoute> {
    if (!directionsService || !elevationService) {
      throw new Error('Maps services are still loading, try again in a moment.')
    }

    const radiusMeters = (request.distanceMeters / (2 * Math.PI)) * LOOP_RADIUS_CALIBRATION

    const candidates = (
      await Promise.all(
        CANDIDATE_ROTATIONS_DEG.map((rotation) => buildCandidate(request.start, radiusMeters, rotation)),
      )
    ).filter((c): c is Candidate => c !== null)

    if (candidates.length === 0) {
      throw new Error('Could not find a route near this location. Try a different starting point.')
    }

    const withinElevationLimit = candidates.filter(
      (c) => c.elevationGainMeters <= request.maxElevationGainMeters,
    )
    const pool = withinElevationLimit.length > 0 ? withinElevationLimit : candidates

    const scored = [...pool].sort((a, b) => {
      if (request.avoidTrafficSignals) {
        const crossingsA = a.trafficSignalCount + a.crossingCount
        const crossingsB = b.trafficSignalCount + b.crossingCount
        if (crossingsA !== crossingsB) return crossingsA - crossingsB
      }
      return (
        Math.abs(a.distanceMeters - request.distanceMeters) -
        Math.abs(b.distanceMeters - request.distanceMeters)
      )
    })

    const best = scored[0]
    return {
      path: best.path,
      distanceMeters: best.distanceMeters,
      elevationGainMeters: best.elevationGainMeters,
      trafficSignalCount: best.trafficSignalCount,
      crossingCount: best.crossingCount,
    }
  }

  return {
    generateRoute,
    ready: Boolean(directionsService && elevationService),
  }
}

