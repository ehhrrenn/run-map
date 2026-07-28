import { useRef, useState } from 'react'
import { APIProvider } from '@vis.gl/react-google-maps'
import { MapView } from './components/MapView'
import { RouteControls } from './components/RouteControls'
import { UnitToggle } from './components/UnitToggle'
import { useRouteGenerator } from './hooks/useRouteGenerator'
import { useInitialMapCenter } from './hooks/useInitialMapCenter'
import { UnitSystemProvider, useUnitSystem } from './hooks/useUnitSystem'
import { GOOGLE_MAPS_API_KEY } from './config/env'
import type { GeneratedRoute, LatLng, RouteRequest } from './types/route'
import {
  distanceUnitLabel,
  elevationUnitLabel,
  metersToDistance,
  metersToElevation,
} from './lib/units'
import { appleMapsWalkingUrl, googleMapsWalkingUrl } from './lib/deeplinks'
import './App.css'

const MAX_REQUIRED_STOPS = 5

function AppInner() {
  const { unitSystem } = useUnitSystem()
  const initialCenter = useInitialMapCenter()
  const { loadNextCandidates, ready, trafficDataWarning } = useRouteGenerator()

  const [start, setStart] = useState<LatLng | null>(null)
  const [requiredStops, setRequiredStops] = useState<LatLng[]>([])
  const [addingStop, setAddingStop] = useState(false)
  const [candidates, setCandidates] = useState<GeneratedRoute[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const lastRequestRef = useRef<RouteRequest | null>(null)

  function handleMapClick(point: LatLng) {
    if (addingStop) {
      setRequiredStops((prev) => [...prev, point])
      setAddingStop(false)
    } else {
      setStart(point)
    }
  }

  function handleRemoveStop(index: number) {
    setRequiredStops((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleGenerate(request: Omit<RouteRequest, 'start' | 'requiredStops'>) {
    if (!start) {
      setError('Click the map to choose a starting point first.')
      return
    }
    const fullRequest: RouteRequest = { ...request, start, requiredStops }
    lastRequestRef.current = fullRequest
    setError(null)
    setLoading(true)
    setCandidates([])
    setSelectedIndex(0)
    try {
      setCandidates(await loadNextCandidates(fullRequest))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a route.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLoadMore() {
    if (!lastRequestRef.current) return
    setLoadingMore(true)
    try {
      const more = await loadNextCandidates(lastRequestRef.current)
      setCandidates((prev) => [...prev, ...more])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load more routes.')
    } finally {
      setLoadingMore(false)
    }
  }

  const selected = candidates[selectedIndex] ?? null

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Run Map</h1>
          <UnitToggle />
        </div>
        <p>Click the map to set a starting point, then set your preferences.</p>

        {requiredStops.length < MAX_REQUIRED_STOPS && (
          <button type="button" onClick={() => setAddingStop((v) => !v)}>
            {addingStop ? 'Click the map to place it (cancel)' : 'Add a required stop'}
          </button>
        )}

        {requiredStops.length > 0 && (
          <ul className="required-stop-list">
            {requiredStops.map((_, index) => (
              <li key={index}>
                <span>Stop {index + 1}</span>
                <button type="button" onClick={() => handleRemoveStop(index)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <RouteControls onSubmit={handleGenerate} disabled={!start || !ready || loading} />
        {loading && <p>Generating route...</p>}
        {error && <p className="error">{error}</p>}
        {trafficDataWarning && <p className="warning">{trafficDataWarning}</p>}

        {candidates.length > 0 && (
          <>
            <ul className="candidate-list">
              {candidates.map((candidate, index) => (
                <li
                  key={index}
                  className={`candidate-card${index === selectedIndex ? ' selected' : ''}`}
                  onClick={() => setSelectedIndex(index)}
                >
                  <dl className="candidate-card__stats">
                    <dt>Distance</dt>
                    <dd>
                      {metersToDistance(candidate.distanceMeters, unitSystem).toFixed(2)}{' '}
                      {distanceUnitLabel(unitSystem)}
                    </dd>
                    <dt>Elevation gain</dt>
                    <dd>
                      {metersToElevation(candidate.elevationGainMeters, unitSystem).toFixed(0)}{' '}
                      {elevationUnitLabel(unitSystem)}
                    </dd>
                    <dt>Traffic signals</dt>
                    <dd>{candidate.trafficSignalCount}</dd>
                    <dt>Crossings</dt>
                    <dd>{candidate.crossingCount}</dd>
                  </dl>
                  {index === selectedIndex && start && (
                    <div className="candidate-card__actions">
                      <a href={googleMapsWalkingUrl(start, candidate.waypoints)} target="_blank" rel="noreferrer">
                        Open in Google Maps
                      </a>
                      <a href={appleMapsWalkingUrl(start, candidate.waypoints)} target="_blank" rel="noreferrer">
                        Open in Apple Maps
                      </a>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="load-more-button"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading...' : 'Load more routes'}
            </button>
          </>
        )}
      </aside>
      <main>
        {initialCenter ? (
          <MapView
            start={start}
            requiredStops={requiredStops}
            path={selected?.path ?? []}
            initialCenter={initialCenter}
            onMapClick={handleMapClick}
          />
        ) : (
          <div className="map-view-loading">Locating you…</div>
        )}
      </main>
    </div>
  )
}

function App() {
  return (
    <UnitSystemProvider>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <AppInner />
      </APIProvider>
    </UnitSystemProvider>
  )
}

export default App
