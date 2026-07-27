import { useMemo, useRef, useState } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import type { GeneratedRoute, LatLng, RouteRequest } from '../types/route'
import { angularDiffDeg, bearingDegBetween, destinationPoint, haversineDistanceMeters } from '../lib/geo'
import { countNodesNearPath, fetchNearbyTrafficNodes, type OverpassNode } from '../lib/crossings'

const CANDIDATE_ROTATIONS_DEG = [0, 60, 120, 180, 240, 300]
// Real streets zigzag relative to a straight loop, so a circle sized exactly
// to the target distance under-shoots once routed onto the road network.
const LOOP_RADIUS_CALIBRATION = 0.72
// Coprime with the 60-degree spacing above, so shifting the rotation set by
// this much per batch never reproduces an earlier batch's angles.
const BATCH_ROTATION_STEP_DEG = 17
const MAX_BATCHES = 40
const CANDIDATES_PER_PAGE = 3
const TRAFFIC_FETCH_PADDING_METERS = 300
const TRAFFIC_DATA_WARNING =
  'Crossing data unavailable right now — showing routes without crossing avoidance.'

interface TrafficNodes {
  signalNodes: OverpassNode[]
  crossingNodes: OverpassNode[]
}

const EMPTY_TRAFFIC_NODES: TrafficNodes = { signalNodes: [], crossingNodes: [] }

function loopWaypoints(start: LatLng, radiusMeters: number, rotationDeg: number): LatLng[] {
  return [0, 120, 240].map((offset) => destinationPoint(start, rotationDeg + offset, radiusMeters))
}

function nearestWaypointIndex(basePoints: LatLng[], start: LatLng, target: LatLng): number {
  const targetBearing = bearingDegBetween(start, target)
  let bestIndex = 0
  let bestDiff = Infinity
  basePoints.forEach((point, index) => {
    const diff = angularDiffDeg(bearingDegBetween(start, point), targetBearing)
    if (diff < bestDiff) {
      bestDiff = diff
      bestIndex = index
    }
  })
  return bestIndex
}

function loopWaypointsWithRequiredStop(
  start: LatLng,
  radiusMeters: number,
  rotationDeg: number,
  requiredStop: LatLng,
): LatLng[] {
  const base = loopWaypoints(start, radiusMeters, rotationDeg)
  const index = nearestWaypointIndex(base, start, requiredStop)
  const result = [...base]
  result[index] = requiredStop
  return result
}

function rotationsForBatch(batchIndex: number): number[] {
  return CANDIDATE_ROTATIONS_DEG.map((deg) => (deg + batchIndex * BATCH_ROTATION_STEP_DEG) % 360)
}

function elevationGainMeters(elevations: number[]): number {
  let gain = 0
  for (let i = 1; i < elevations.length; i++) {
    const delta = elevations[i] - elevations[i - 1]
    if (delta > 0) gain += delta
  }
  return gain
}

function scoreCandidates(candidates: GeneratedRoute[], request: RouteRequest): GeneratedRoute[] {
  const withinElevationLimit = candidates.filter(
    (c) => c.elevationGainMeters <= request.maxElevationGainMeters,
  )
  const pool = withinElevationLimit.length > 0 ? withinElevationLimit : candidates

  return [...pool].sort((a, b) => {
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
}

interface CandidateCache {
  signature: string
  nextBatchIndex: number
  pendingQueue: GeneratedRoute[]
  trafficNodes: TrafficNodes
}

function emptyCache(signature: string, trafficNodes: TrafficNodes): CandidateCache {
  return { signature, nextBatchIndex: 0, pendingQueue: [], trafficNodes }
}

export function useRouteGenerator() {
  const routesLibrary = useMapsLibrary('routes')
  const elevationLibrary = useMapsLibrary('elevation')
  const cacheRef = useRef<CandidateCache>(emptyCache('', EMPTY_TRAFFIC_NODES))
  const [trafficDataWarning, setTrafficDataWarning] = useState<string | null>(null)

  const elevationService = useMemo(
    () => (elevationLibrary ? new elevationLibrary.ElevationService() : null),
    [elevationLibrary],
  )

  async function routeForWaypoints(start: LatLng, waypoints: LatLng[]) {
    if (!routesLibrary) throw new Error('Routes library not ready')

    const { routes } = await routesLibrary.Route.computeRoutes({
      origin: start,
      destination: start,
      intermediates: waypoints.map((location) => ({ location })),
      travelMode: google.maps.TravelMode.WALKING,
      fields: ['distanceMeters', 'path'],
    })

    const route = routes?.[0]
    if (!route?.path) throw new Error('No route found')

    const distanceMeters = route.distanceMeters ?? 0
    const path = route.path.map((p) => ({ lat: p.lat, lng: p.lng }))

    return { path, distanceMeters }
  }

  async function buildCandidate(
    start: LatLng,
    radiusMeters: number,
    rotationDeg: number,
    trafficNodes: TrafficNodes,
    requiredStop?: LatLng,
  ): Promise<GeneratedRoute | null> {
    if (!elevationService) throw new Error('Elevation service not ready')

    try {
      const waypoints = requiredStop
        ? loopWaypointsWithRequiredStop(start, radiusMeters, rotationDeg, requiredStop)
        : loopWaypoints(start, radiusMeters, rotationDeg)
      const { path, distanceMeters } = await routeForWaypoints(start, waypoints)

      const elevationResult = await elevationService.getElevationAlongPath({
        path,
        samples: 100,
      })
      const gain = elevationGainMeters(elevationResult.results.map((r) => r.elevation))

      return {
        path,
        waypoints,
        distanceMeters,
        elevationGainMeters: gain,
        trafficSignalCount: countNodesNearPath(trafficNodes.signalNodes, path),
        crossingCount: countNodesNearPath(trafficNodes.crossingNodes, path),
      }
    } catch {
      return null
    }
  }

  async function computeBatch(
    request: RouteRequest,
    batchIndex: number,
    trafficNodes: TrafficNodes,
  ): Promise<GeneratedRoute[]> {
    const radiusMeters = (request.distanceMeters / (2 * Math.PI)) * LOOP_RADIUS_CALIBRATION
    const rotations = rotationsForBatch(batchIndex)

    const raw = (
      await Promise.all(
        rotations.map((rotation) =>
          buildCandidate(request.start, radiusMeters, rotation, trafficNodes, request.requiredStop),
        ),
      )
    ).filter((c): c is GeneratedRoute => c !== null)

    return scoreCandidates(raw, request)
  }

  async function loadNextCandidates(request: RouteRequest): Promise<GeneratedRoute[]> {
    if (!routesLibrary || !elevationService) {
      throw new Error('Maps services are still loading, try again in a moment.')
    }

    const signature = JSON.stringify(request)
    if (cacheRef.current.signature !== signature) {
      const radiusMeters = (request.distanceMeters / (2 * Math.PI)) * LOOP_RADIUS_CALIBRATION
      const requiredStopDistance = request.requiredStop
        ? haversineDistanceMeters(request.start, request.requiredStop)
        : 0
      const fetchRadius = Math.max(radiusMeters, requiredStopDistance) + TRAFFIC_FETCH_PADDING_METERS

      let trafficNodes = EMPTY_TRAFFIC_NODES
      try {
        trafficNodes = await fetchNearbyTrafficNodes(request.start, fetchRadius)
        setTrafficDataWarning(null)
      } catch {
        setTrafficDataWarning(TRAFFIC_DATA_WARNING)
      }

      cacheRef.current = emptyCache(signature, trafficNodes)
    }
    const cache = cacheRef.current

    while (cache.pendingQueue.length < CANDIDATES_PER_PAGE && cache.nextBatchIndex < MAX_BATCHES) {
      const batch = await computeBatch(request, cache.nextBatchIndex, cache.trafficNodes)
      cache.nextBatchIndex += 1
      cache.pendingQueue.push(...batch)
    }

    const page = cache.pendingQueue.splice(0, CANDIDATES_PER_PAGE)
    if (page.length === 0) {
      throw new Error('Could not find more distinct routes near this location.')
    }
    return page
  }

  return {
    loadNextCandidates,
    ready: Boolean(routesLibrary && elevationService),
    trafficDataWarning,
  }
}
