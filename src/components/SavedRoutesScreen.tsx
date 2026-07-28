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
  type UnitSystem,
} from '../lib/units'
import { appleMapsWalkingUrl, googleMapsWalkingUrl } from '../lib/deeplinks'

function parseOptionalDistance(value: string, unitSystem: UnitSystem): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : distanceToMeters(parsed, unitSystem)
}

export function SavedRoutesScreen() {
  const { user } = useAuth()
  const { unitSystem } = useUnitSystem()
  const navigate = useNavigate()

  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([])
  const [nameFilter, setNameFilter] = useState('')
  const [minDistance, setMinDistance] = useState('')
  const [maxDistance, setMaxDistance] = useState('')
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
    minDistanceMeters: parseOptionalDistance(minDistance, unitSystem),
    maxDistanceMeters: parseOptionalDistance(maxDistance, unitSystem),
  })

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
          Min distance ({distanceUnitLabel(unitSystem)})
          <input
            type="number"
            min="0"
            step="0.1"
            value={minDistance}
            onChange={(e) => setMinDistance(e.target.value)}
          />
        </label>
        <label>
          Max distance ({distanceUnitLabel(unitSystem)})
          <input
            type="number"
            min="0"
            step="0.1"
            value={maxDistance}
            onChange={(e) => setMaxDistance(e.target.value)}
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
