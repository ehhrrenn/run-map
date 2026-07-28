import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import { useUnitSystem } from '../hooks/useUnitSystem'
import { deleteSavedRoute, subscribeSavedRoutes } from '../lib/savedRoutes'
import { filterSavedRoutes } from '../lib/savedRoutesFilter'
import type { SavedRoute } from '../types/route'
import {
  distanceToMeters,
  distanceUnitLabel,
  elevationUnitLabel,
  metersToDistance,
  metersToElevation,
} from '../lib/units'
import { appleMapsWalkingUrl, googleMapsWalkingUrl } from '../lib/deeplinks'

// A fixed real-world bound (not re-interpreted per unit system) so toggling
// units only changes the displayed numbers, not what's actually filtered -
// slider at either end means "no bound" on that side.
const MAX_DISTANCE_FILTER_METERS = 32000
const DISTANCE_FILTER_STEP = 0.5

export function SavedRoutesScreen() {
  const { user } = useAuth()
  const { unitSystem } = useUnitSystem()
  const navigate = useNavigate()

  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([])
  const [nameFilter, setNameFilter] = useState('')
  const [minDistanceMeters, setMinDistanceMeters] = useState(0)
  const [maxDistanceMeters, setMaxDistanceMeters] = useState(MAX_DISTANCE_FILTER_METERS)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setSavedRoutes([])
      return
    }
    return subscribeSavedRoutes(user.uid, setSavedRoutes)
  }, [user])

  if (!user) {
    return (
      <div className="saved-routes-screen">
        <p>Sign in with Google to see your saved routes.</p>
      </div>
    )
  }

  const filtered = filterSavedRoutes(savedRoutes, {
    nameQuery: nameFilter,
    minDistanceMeters: minDistanceMeters <= 0 ? null : minDistanceMeters,
    maxDistanceMeters: maxDistanceMeters >= MAX_DISTANCE_FILTER_METERS ? null : maxDistanceMeters,
  })

  function handleMinSliderChange(displayValue: number) {
    const meters = Math.min(distanceToMeters(displayValue, unitSystem), maxDistanceMeters)
    setMinDistanceMeters(meters)
  }

  function handleMaxSliderChange(displayValue: number) {
    const meters = Math.max(distanceToMeters(displayValue, unitSystem), minDistanceMeters)
    setMaxDistanceMeters(meters)
  }

  async function handleDelete(routeId: string) {
    if (!user) return
    setActionError(null)
    try {
      await deleteSavedRoute(user.uid, routeId)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete route.')
    } finally {
      setConfirmingDeleteId(null)
    }
  }

  return (
    <div className="saved-routes-screen">
      <div className="saved-routes-filters">
        <input
          type="text"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          placeholder="Search by name"
          aria-label="Search saved routes by name"
        />
        <label>
          Min distance: {metersToDistance(minDistanceMeters, unitSystem).toFixed(1)}{' '}
          {distanceUnitLabel(unitSystem)}
          <input
            type="range"
            min={0}
            max={metersToDistance(MAX_DISTANCE_FILTER_METERS, unitSystem)}
            step={DISTANCE_FILTER_STEP}
            value={metersToDistance(minDistanceMeters, unitSystem)}
            onChange={(e) => handleMinSliderChange(Number(e.target.value))}
          />
        </label>
        <label>
          Max distance:{' '}
          {maxDistanceMeters >= MAX_DISTANCE_FILTER_METERS
            ? 'no limit'
            : `${metersToDistance(maxDistanceMeters, unitSystem).toFixed(1)} ${distanceUnitLabel(unitSystem)}`}
          <input
            type="range"
            min={0}
            max={metersToDistance(MAX_DISTANCE_FILTER_METERS, unitSystem)}
            step={DISTANCE_FILTER_STEP}
            value={metersToDistance(maxDistanceMeters, unitSystem)}
            onChange={(e) => handleMaxSliderChange(Number(e.target.value))}
          />
        </label>
      </div>

      {actionError && <p className="error">{actionError}</p>}
      {savedRoutes.length === 0 && <p>No saved routes yet — save one from the planner.</p>}
      {savedRoutes.length > 0 && filtered.length === 0 && (
        <p>No saved routes match your search/filter.</p>
      )}

      <ul className="candidate-list">
        {filtered.map((route) => (
          <li key={route.id} className="candidate-card">
            <h2 className="saved-route-name">{route.name}</h2>
            <dl className="candidate-card__stats">
              <dt>Distance</dt>
              <dd>
                {metersToDistance(route.distanceMeters, unitSystem).toFixed(2)}{' '}
                {distanceUnitLabel(unitSystem)}
              </dd>
              <dt>Elevation gain</dt>
              <dd>
                {metersToElevation(route.elevationGainMeters, unitSystem).toFixed(0)}{' '}
                {elevationUnitLabel(unitSystem)}
              </dd>
              <dt>Traffic signals</dt>
              <dd>{route.trafficSignalCount}</dd>
              <dt>Crossings</dt>
              <dd>{route.crossingCount}</dd>
              <dt>Turns</dt>
              <dd>{route.turnCount}</dd>
            </dl>
            <div className="candidate-card__actions">
              <a href={googleMapsWalkingUrl(route.start, route.waypoints)} target="_blank" rel="noreferrer">
                Open in Google Maps
              </a>
              <a href={appleMapsWalkingUrl(route.start, route.waypoints)} target="_blank" rel="noreferrer">
                Open in Apple Maps
              </a>
              <button type="button" onClick={() => navigate('/', { state: { savedRoute: route } })}>
                Load in planner
              </button>
              {confirmingDeleteId === route.id ? (
                <>
                  <button type="button" onClick={() => void handleDelete(route.id)}>
                    Confirm delete
                  </button>
                  <button type="button" onClick={() => setConfirmingDeleteId(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmingDeleteId(route.id)}>
                  Delete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
