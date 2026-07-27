import { useState } from 'react'
import { MapView } from './components/MapView'
import { RouteControls } from './components/RouteControls'
import type { GeneratedRoute, LatLng, RouteRequest } from './types/route'
import './App.css'

function App() {
  const [start, setStart] = useState<LatLng | null>(null)
  const [route, setRoute] = useState<GeneratedRoute | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate(request: Omit<RouteRequest, 'start'>) {
    if (!start) {
      setError('Click the map to choose a starting point first.')
      return
    }
    setError(null)
    // TODO: replace with real route-generation logic (Directions/Roads/Elevation APIs).
    setRoute({
      path: [start],
      distanceMeters: 0,
      elevationGainMeters: 0,
      trafficSignalCount: 0,
      crossingCount: 0,
    })
    void request
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h1>Run Map</h1>
        <p>Click the map to set a starting point, then set your preferences.</p>
        <RouteControls onSubmit={handleGenerate} disabled={!start} />
        {error && <p className="error">{error}</p>}
      </aside>
      <main>
        <MapView start={start} path={route?.path ?? []} onMapClick={setStart} />
      </main>
    </div>
  )
}

export default App
