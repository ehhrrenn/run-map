import { useState } from 'react'
import { APIProvider } from '@vis.gl/react-google-maps'
import { MapView } from './components/MapView'
import { RouteControls } from './components/RouteControls'
import { useRouteGenerator } from './hooks/useRouteGenerator'
import { GOOGLE_MAPS_API_KEY } from './config/env'
import type { GeneratedRoute, LatLng, RouteRequest } from './types/route'
import './App.css'

function AppInner() {
  const [start, setStart] = useState<LatLng | null>(null)
  const [route, setRoute] = useState<GeneratedRoute | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { generateRoute, ready } = useRouteGenerator()

  async function handleGenerate(request: Omit<RouteRequest, 'start'>) {
    if (!start) {
      setError('Click the map to choose a starting point first.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const generated = await generateRoute({ ...request, start })
      setRoute(generated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a route.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h1>Run Map</h1>
        <p>Click the map to set a starting point, then set your preferences.</p>
        <RouteControls onSubmit={handleGenerate} disabled={!start || !ready || loading} />
        {loading && <p>Generating route...</p>}
        {error && <p className="error">{error}</p>}
        {route && !loading && (
          <dl className="route-summary">
            <dt>Distance</dt>
            <dd>{(route.distanceMeters / 1000).toFixed(2)} km</dd>
            <dt>Elevation gain</dt>
            <dd>{route.elevationGainMeters.toFixed(0)} m</dd>
            <dt>Traffic signals</dt>
            <dd>{route.trafficSignalCount}</dd>
            <dt>Crossings</dt>
            <dd>{route.crossingCount}</dd>
          </dl>
        )}
      </aside>
      <main>
        <MapView start={start} path={route?.path ?? []} onMapClick={setStart} />
      </main>
    </div>
  )
}

function App() {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <AppInner />
    </APIProvider>
  )
}

export default App
