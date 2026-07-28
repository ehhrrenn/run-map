import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { MapView } from './MapView'
import { RouteControls } from './RouteControls'
import { useRouteGenerator } from '../hooks/useRouteGenerator'
import { useInitialMapCenter } from '../hooks/useInitialMapCenter'
import { useUnitSystem } from '../hooks/useUnitSystem'
import { useAuth } from '../hooks/useAuth'
import { saveRoute } from '../lib/savedRoutes'
import type { GeneratedRoute, LatLng, RouteRequest, SavedRoute } from '../types/route'
import {
  distanceUnitLabel,
  elevationUnitLabel,
  metersToDistance,
  metersToElevation,
} from '../lib/units'
import { appleMapsWalkingUrl, googleMapsWalkingUrl } from '../lib/deeplinks'

const MAX_REQUIRED_STOPS = 5

const MOBILE_LAYOUT_QUERY = '(max-width: 768px)'
const STORAGE_KEY_WIDTH = 'run-map:sidebar-width'
const STORAGE_KEY_HEIGHT_VH = 'run-map:sidebar-height-vh'
const STORAGE_KEY_COLLAPSED = 'run-map:sidebar-collapsed'
const DEFAULT_WIDTH_PX = 320
const MIN_WIDTH_PX = 240
const MAX_WIDTH_PX = 640
const DEFAULT_HEIGHT_VH = 50
const MIN_HEIGHT_VH = 15
const MAX_HEIGHT_VH = 80

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function readStoredNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw === null ? NaN : Number(raw)
    return Number.isFinite(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : raw === 'true'
  } catch {
    return fallback
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) - the sizing
    // preference just won't persist across sessions.
  }
}

export function PlannerScreen() {
  const location = useLocation()
  const { unitSystem } = useUnitSystem()
  const { user, signIn } = useAuth()
  const initialCenter = useInitialMapCenter()
  const { loadNextCandidates, ready, trafficDataWarning, elevationLimitWarning } = useRouteGenerator()

  const [start, setStart] = useState<LatLng | null>(null)
  const [requiredStops, setRequiredStops] = useState<LatLng[]>([])
  const [addingStop, setAddingStop] = useState(false)
  const [candidates, setCandidates] = useState<GeneratedRoute[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isNamingRoute, setIsNamingRoute] = useState(false)
  const [routeName, setRouteName] = useState('')
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const lastRequestRef = useRef<RouteRequest | null>(null)

  const [isMobileLayout, setIsMobileLayout] = useState(
    () => window.matchMedia(MOBILE_LAYOUT_QUERY).matches,
  )
  const [sidebarWidth, setSidebarWidth] = useState(() => readStoredNumber(STORAGE_KEY_WIDTH, DEFAULT_WIDTH_PX))
  const [sidebarHeightVh, setSidebarHeightVh] = useState(() =>
    readStoredNumber(STORAGE_KEY_HEIGHT_VH, DEFAULT_HEIGHT_VH),
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    readStoredBoolean(STORAGE_KEY_COLLAPSED, false),
  )

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_LAYOUT_QUERY)
    const listener = (e: MediaQueryListEvent) => setIsMobileLayout(e.matches)
    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }, [])

  function setSidebarCollapsedPersisted(next: boolean) {
    setSidebarCollapsed(next)
    writeStored(STORAGE_KEY_COLLAPSED, String(next))
  }

  function handleResizeStart(startPos: number) {
    if (sidebarCollapsed) setSidebarCollapsedPersisted(false)
    const startSize = isMobileLayout ? sidebarHeightVh : sidebarWidth

    function applyDelta(pos: number) {
      const delta = pos - startPos
      if (isMobileLayout) {
        const deltaVh = (delta / window.innerHeight) * 100
        const next = clamp(startSize + deltaVh, MIN_HEIGHT_VH, MAX_HEIGHT_VH)
        setSidebarHeightVh(next)
        writeStored(STORAGE_KEY_HEIGHT_VH, String(next))
      } else {
        const next = clamp(startSize + delta, MIN_WIDTH_PX, MAX_WIDTH_PX)
        setSidebarWidth(next)
        writeStored(STORAGE_KEY_WIDTH, String(next))
      }
    }

    function onMouseMove(e: MouseEvent) {
      applyDelta(isMobileLayout ? e.clientY : e.clientX)
    }
    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 0) return
      applyDelta(isMobileLayout ? e.touches[0].clientY : e.touches[0].clientX)
      e.preventDefault()
    }
    function onEnd() {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onEnd)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onEnd)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onEnd)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onEnd)
  }

  useEffect(() => {
    const state = location.state as { savedRoute?: SavedRoute } | null
    if (state?.savedRoute) {
      const saved = state.savedRoute
      setStart(saved.start)
      setRequiredStops(saved.requiredStops)
      setCandidates([saved])
      setSelectedIndex(0)
    }
  }, [location.state])

  useEffect(() => {
    setIsNamingRoute(false)
    setRouteName('')
    setSaveStatus(null)
  }, [selectedIndex])

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

  async function handleConfirmSave(candidate: GeneratedRoute) {
    if (!user || !start || !routeName.trim()) return
    setSaveStatus(null)
    try {
      await saveRoute(user.uid, routeName.trim(), candidate, start, requiredStops)
      setIsNamingRoute(false)
      setRouteName('')
      setSaveStatus('Saved!')
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : 'Could not save route.')
    }
  }

  const selected = candidates[selectedIndex] ?? null

  return (
    <div className="app-layout">
      <aside
        className={`sidebar${sidebarCollapsed ? ' sidebar--collapsed' : ''}`}
        style={
          isMobileLayout
            ? { maxHeight: sidebarCollapsed ? 0 : `${sidebarHeightVh}vh` }
            : { width: sidebarCollapsed ? 0 : sidebarWidth }
        }
      >
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
        {elevationLimitWarning && <p className="warning">{elevationLimitWarning}</p>}

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
                    <dt>Turns</dt>
                    <dd>{candidate.turnCount}</dd>
                  </dl>
                  {index === selectedIndex && start && (
                    <div className="candidate-card__actions">
                      <a href={googleMapsWalkingUrl(start, candidate.waypoints)} target="_blank" rel="noreferrer">
                        Open in Google Maps
                      </a>
                      <a href={appleMapsWalkingUrl(start, candidate.waypoints)} target="_blank" rel="noreferrer">
                        Open in Apple Maps
                      </a>
                      {!user && (
                        <button type="button" onClick={() => void signIn()}>
                          Sign in to save
                        </button>
                      )}
                      {user && !isNamingRoute && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setIsNamingRoute(true)
                          }}
                        >
                          Save route
                        </button>
                      )}
                    </div>
                  )}
                  {index === selectedIndex && user && isNamingRoute && (
                    <div className="candidate-card__save-form" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={routeName}
                        onChange={(e) => setRouteName(e.target.value)}
                        placeholder="Route name"
                        aria-label="Route name"
                      />
                      <button type="button" onClick={() => void handleConfirmSave(candidate)} disabled={!routeName.trim()}>
                        Save
                      </button>
                      <button type="button" onClick={() => setIsNamingRoute(false)}>
                        Cancel
                      </button>
                    </div>
                  )}
                  {index === selectedIndex && saveStatus && <p className="warning">{saveStatus}</p>}
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
      <div
        className="resize-handle"
        role="separator"
        aria-orientation={isMobileLayout ? 'horizontal' : 'vertical'}
        aria-label="Resize planner panel"
        onMouseDown={(e) => {
          e.preventDefault()
          handleResizeStart(isMobileLayout ? e.clientY : e.clientX)
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 0) return
          handleResizeStart(isMobileLayout ? e.touches[0].clientY : e.touches[0].clientX)
        }}
      >
        <button
          type="button"
          className="resize-handle__toggle"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            setSidebarCollapsedPersisted(!sidebarCollapsed)
          }}
          aria-label={sidebarCollapsed ? 'Expand planner panel' : 'Collapse planner panel'}
        >
          {isMobileLayout ? (sidebarCollapsed ? '⌄' : '⌃') : sidebarCollapsed ? '›' : '‹'}
        </button>
      </div>
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
