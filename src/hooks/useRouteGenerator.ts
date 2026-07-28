import { useMemo, useRef, useState } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import type { GeneratedRoute, LatLng, RouteRequest } from '../types/route'
import { angularDiffDeg, bearingDegBetween, destinationPoint, haversineDistanceMeters } from '../lib/geo'
import { countNodesNearPath, fetchNearbyTrafficNodes, type OverpassNode } from '../lib/crossings'
import { fetchNearbyPedestrianTrails, snapToNearestTrail, type PedestrianTrail } from '../lib/trails'

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
// Prefer routes that don't overshoot the requested distance by more than this.
const DISTANCE_OVERSHOOT_TOLERANCE = 1.05
const TRAFFIC_DATA_WARNING =
  'Crossing data unavailable right now — showing routes without crossing avoidance.'
const ELEVATION_LIMIT_WARNING =
  'No routes found within your max elevation gain near this location — showing the closest matches instead.'
// Two candidates whose loop waypoints average closer together than this
// fraction of the loop radius are considered the same underlying route
// (e.g. both snapped onto the same nearby trail), not distinct options.
const MIN_DIVERGENCE_RADIUS_FRACTION = 0.25

interface TrafficNodes {
  signalNodes: OverpassNode[]
  crossingNodes: OverpassNode[]
}

const EMPTY_TRAFFIC_NODES: TrafficNodes = { signalNodes: [], crossingNodes: [] }

const MIN_LOOP_WAYPOINTS = 3

function loopWaypoints(
  start: LatLng,
  radiusMeters: number,
  rotationDeg: number,
  count: number = MIN_LOOP_WAYPOINTS,
  trails: PedestrianTrail[] = [],
): LatLng[] {
  const angleStep = 360 / count
  const points = Array.from({ length: count }, (_, i) =>
    destinationPoint(start, rotationDeg + i * angleStep, radiusMeters),
  )
  return trails.length === 0 ? points : points.map((p) => snapToNearestTrail(p, trails))
}

/** Substitutes each required stop into whichever of the base loop points is
 * angularly closest to it (from `start`) that isn't already taken, so N
 * required stops always produce a loop with exactly max(3, N) waypoints. */
function loopWaypointsWithRequiredStops(
  start: LatLng,
  radiusMeters: number,
  rotationDeg: number,
  requiredStops: LatLng[],
  trails: PedestrianTrail[] = [],
): LatLng[] {
  const count = Math.max(MIN_LOOP_WAYPOINTS, requiredStops.length)
  const base = loopWaypoints(start, radiusMeters, rotationDeg, count, trails)
  const result = [...base]
  const used = new Set<number>()

  for (const stop of requiredStops) {
    const targetBearing = bearingDegBetween(start, stop)
    let bestIndex = -1
    let bestDiff = Infinity
    base.forEach((point, index) => {
      if (used.has(index)) return
      const diff = angularDiffDeg(bearingDegBetween(start, point), targetBearing)
      if (diff < bestDiff) {
        bestDiff = diff
        bestIndex = index
      }
    })
    result[bestIndex] = stop
    used.add(bestIndex)
  }

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
  const elevationPool = withinElevationLimit.length > 0 ? withinElevationLimit : candidates

  const maxAcceptableDistance = request.distanceMeters * DISTANCE_OVERSHOOT_TOLERANCE
  const withinDistanceTolerance = elevationPool.filter((c) => c.distanceMeters <= maxAcceptableDistance)
  const pool = withinDistanceTolerance.length > 0 ? withinDistanceTolerance : elevationPool

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
  rawPool: GeneratedRoute[]
  served: Set<GeneratedRoute>
  trafficNodes: TrafficNodes
  trails: PedestrianTrail[]
}

function emptyCache(
  signature: string,
  trafficNodes: TrafficNodes,
  trails: PedestrianTrail[],
): CandidateCache {
  return { signature, nextBatchIndex: 0, rawPool: [], served: new Set(), trafficNodes, trails }
}

function meetsHardConstraints(candidate: GeneratedRoute, request: RouteRequest): boolean {
  const maxAcceptableDistance = request.distanceMeters * DISTANCE_OVERSHOOT_TOLERANCE
  return (
    candidate.elevationGainMeters <= request.maxElevationGainMeters &&
    candidate.distanceMeters <= maxAcceptableDistance
  )
}

function averageWaypointDivergenceMeters(a: LatLng[], b: LatLng[]): number {
  if (a.length === 0 || a.length !== b.length) return Infinity
  const total = a.reduce((sum, point, i) => sum + haversineDistanceMeters(point, b[i]), 0)
  return total / a.length
}

/** Greedily picks up to `count` candidates (already sorted best-first) that
 * are each meaningfully different in shape from `avoid` and from each other,
 * so "3 route options" doesn't mean 3 near-identical variants of the one
 * route the road network (or trail-snapping) keeps converging on. */
function pickDistinctCandidates(
  sortedCandidates: GeneratedRoute[],
  avoid: GeneratedRoute[],
  count: number,
  minDivergenceMeters: number,
): GeneratedRoute[] {
  const chosen: GeneratedRoute[] = []
  for (const candidate of sortedCandidates) {
    const tooSimilar = [...avoid, ...chosen].some(
      (existing) => averageWaypointDivergenceMeters(candidate.waypoints, existing.waypoints) < minDivergenceMeters,
    )
    if (!tooSimilar) chosen.push(candidate)
    if (chosen.length >= count) break
  }
  return chosen
}

export function useRouteGenerator() {
  const routesLibrary = useMapsLibrary('routes')
  const elevationLibrary = useMapsLibrary('elevation')
  const cacheRef = useRef<CandidateCache>(emptyCache('', EMPTY_TRAFFIC_NODES, []))
  const lastErrorRef = useRef<string | null>(null)
  const [trafficDataWarning, setTrafficDataWarning] = useState<string | null>(null)
  const [elevationLimitWarning, setElevationLimitWarning] = useState<string | null>(null)

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
    trails: PedestrianTrail[],
    requiredStops: LatLng[],
  ): Promise<GeneratedRoute | null> {
    if (!elevationService) throw new Error('Elevation service not ready')

    try {
      const waypoints =
        requiredStops.length > 0
          ? loopWaypointsWithRequiredStops(start, radiusMeters, rotationDeg, requiredStops, trails)
          : loopWaypoints(start, radiusMeters, rotationDeg, MIN_LOOP_WAYPOINTS, trails)
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
    } catch (err) {
      lastErrorRef.current = err instanceof Error ? err.message : String(err)
      console.error('Route candidate failed:', err)
      return null
    }
  }

  async function computeBatch(
    request: RouteRequest,
    batchIndex: number,
    trafficNodes: TrafficNodes,
    trails: PedestrianTrail[],
  ): Promise<GeneratedRoute[]> {
    const radiusMeters = (request.distanceMeters / (2 * Math.PI)) * LOOP_RADIUS_CALIBRATION
    const rotations = rotationsForBatch(batchIndex)

    return (
      await Promise.all(
        rotations.map((rotation) =>
          buildCandidate(
            request.start,
            radiusMeters,
            rotation,
            trafficNodes,
            trails,
            request.requiredStops,
          ),
        ),
      )
    ).filter((c): c is GeneratedRoute => c !== null)
  }

  async function loadNextCandidates(request: RouteRequest): Promise<GeneratedRoute[]> {
    if (!routesLibrary || !elevationService) {
      throw new Error('Maps services are still loading, try again in a moment.')
    }

    const signature = JSON.stringify(request)
    if (cacheRef.current.signature !== signature) {
      const radiusMeters = (request.distanceMeters / (2 * Math.PI)) * LOOP_RADIUS_CALIBRATION
      const maxRequiredStopDistance = request.requiredStops.reduce(
        (max, stop) => Math.max(max, haversineDistanceMeters(request.start, stop)),
        0,
      )
      const fetchRadius = Math.max(radiusMeters, maxRequiredStopDistance) + TRAFFIC_FETCH_PADDING_METERS

      // Only worth the extra query when the user actually wants to avoid
      // crossings - otherwise there's nothing to bias the loop shape toward.
      const [trafficNodesResult, trailsResult] = await Promise.allSettled([
        fetchNearbyTrafficNodes(request.start, fetchRadius),
        request.avoidTrafficSignals
          ? fetchNearbyPedestrianTrails(request.start, fetchRadius)
          : Promise.resolve<PedestrianTrail[]>([]),
      ])

      if (trafficNodesResult.status === 'fulfilled') {
        setTrafficDataWarning(null)
      } else {
        setTrafficDataWarning(TRAFFIC_DATA_WARNING)
      }
      const trafficNodes = trafficNodesResult.status === 'fulfilled' ? trafficNodesResult.value : EMPTY_TRAFFIC_NODES
      const trails = trailsResult.status === 'fulfilled' ? trailsResult.value : []

      cacheRef.current = emptyCache(signature, trafficNodes, trails)
    }
    const cache = cacheRef.current
    const radiusMeters = (request.distanceMeters / (2 * Math.PI)) * LOOP_RADIUS_CALIBRATION
    const minDivergenceMeters = radiusMeters * MIN_DIVERGENCE_RADIUS_FRACTION
    const servedList = Array.from(cache.served)

    function candidatePage(): GeneratedRoute[] {
      const unserved = cache.rawPool.filter((c) => !cache.served.has(c) && meetsHardConstraints(c, request))
      return pickDistinctCandidates(scoreCandidates(unserved, request), servedList, CANDIDATES_PER_PAGE, minDivergenceMeters)
    }

    // Keep fetching more batches (different loop rotations) specifically
    // hunting for candidates that satisfy the elevation/distance limits AND
    // are meaningfully different from each other - otherwise a hilly first
    // attempt silently defeats the elevation cap, or trail-snapping collapses
    // every rotation onto the same nearby path and "3 routes" are really one.
    while (candidatePage().length < CANDIDATES_PER_PAGE && cache.nextBatchIndex < MAX_BATCHES) {
      const isFirstBatch = cache.nextBatchIndex === 0
      const batch = await computeBatch(request, cache.nextBatchIndex, cache.trafficNodes, cache.trails)
      cache.nextBatchIndex += 1
      cache.rawPool.push(...batch)

      if (isFirstBatch && batch.length === 0) {
        // Every candidate failing on the very first attempt means something
        // systemic is wrong (API config, auth, network) - not that this
        // particular spot has no walkable routes. Fail fast with the real
        // reason instead of burning the full retry budget on a doomed request.
        throw new Error(
          lastErrorRef.current
            ? `Route generation failed: ${lastErrorRef.current}`
            : 'Could not generate any routes near this location.',
        )
      }
    }

    const unserved = cache.rawPool.filter((c) => !cache.served.has(c))
    setElevationLimitWarning(
      unserved.some((c) => meetsHardConstraints(c, request)) ? null : ELEVATION_LIMIT_WARNING,
    )

    let page = candidatePage()
    if (page.length < CANDIDATES_PER_PAGE && unserved.length > 0) {
      // Search exhausted without enough distinct, compliant candidates -
      // fill remaining slots from the full unserved pool, still preferring
      // distinct shapes over duplicates where any are available.
      const fallbackSorted = scoreCandidates(unserved, request)
      const additional = pickDistinctCandidates(
        fallbackSorted,
        [...servedList, ...page],
        CANDIDATES_PER_PAGE - page.length,
        minDivergenceMeters,
      )
      page = [...page, ...additional]
      if (page.length < CANDIDATES_PER_PAGE) {
        const remaining = fallbackSorted.filter((c) => !page.includes(c))
        page = [...page, ...remaining.slice(0, CANDIDATES_PER_PAGE - page.length)]
      }
    }
    page.forEach((c) => cache.served.add(c))
    if (page.length === 0) {
      throw new Error('Could not find more distinct routes near this location.')
    }
    return page
  }

  return {
    loadNextCandidates,
    ready: Boolean(routesLibrary && elevationService),
    trafficDataWarning,
    elevationLimitWarning,
  }
}
