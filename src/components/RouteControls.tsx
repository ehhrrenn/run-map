import { useState } from 'react'
import type { RouteRequest } from '../types/route'

interface RouteControlsProps {
  onSubmit: (request: Omit<RouteRequest, 'start'>) => void
  disabled?: boolean
}

export function RouteControls({ onSubmit, disabled }: RouteControlsProps) {
  const [distanceKm, setDistanceKm] = useState(5)
  const [maxElevationGain, setMaxElevationGain] = useState(50)
  const [avoidTrafficSignals, setAvoidTrafficSignals] = useState(true)

  return (
    <form
      className="route-controls"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          distanceMeters: distanceKm * 1000,
          maxElevationGainMeters: maxElevationGain,
          avoidTrafficSignals,
        })
      }}
    >
      <label>
        Distance (km)
        <input
          type="number"
          min={1}
          step={0.5}
          value={distanceKm}
          onChange={(e) => setDistanceKm(Number(e.target.value))}
        />
      </label>

      <label>
        Max elevation gain (m)
        <input
          type="number"
          min={0}
          step={5}
          value={maxElevationGain}
          onChange={(e) => setMaxElevationGain(Number(e.target.value))}
        />
      </label>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={avoidTrafficSignals}
          onChange={(e) => setAvoidTrafficSignals(e.target.checked)}
        />
        Minimize stop lights / crossings
      </label>

      <button type="submit" disabled={disabled}>
        Generate route
      </button>
    </form>
  )
}
