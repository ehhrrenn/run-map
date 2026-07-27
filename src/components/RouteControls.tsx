import { useState } from 'react'
import type { RouteRequest } from '../types/route'
import { useUnitSystem } from '../hooks/useUnitSystem'
import {
  distanceToMeters,
  distanceUnitLabel,
  elevationToMeters,
  elevationUnitLabel,
  metersToDistance,
  metersToElevation,
} from '../lib/units'

interface RouteControlsProps {
  onSubmit: (request: Omit<RouteRequest, 'start'>) => void
  disabled?: boolean
}

const DEFAULT_DISTANCE_METERS = 5000
const DEFAULT_MAX_ELEVATION_GAIN_METERS = 50

export function RouteControls({ onSubmit, disabled }: RouteControlsProps) {
  const { unitSystem } = useUnitSystem()
  const [distanceMeters, setDistanceMeters] = useState(DEFAULT_DISTANCE_METERS)
  const [maxElevationGainMeters, setMaxElevationGainMeters] = useState(
    DEFAULT_MAX_ELEVATION_GAIN_METERS,
  )
  const [avoidTrafficSignals, setAvoidTrafficSignals] = useState(true)

  return (
    <form
      className="route-controls"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ distanceMeters, maxElevationGainMeters, avoidTrafficSignals })
      }}
    >
      <label htmlFor="distance">
        Distance ({distanceUnitLabel(unitSystem)})
        <input
          id="distance"
          name="distance"
          type="number"
          min={0.1}
          step={0.1}
          value={metersToDistance(distanceMeters, unitSystem).toFixed(2)}
          onChange={(e) => setDistanceMeters(distanceToMeters(Number(e.target.value), unitSystem))}
        />
      </label>

      <label htmlFor="max-elevation-gain">
        Max elevation gain ({elevationUnitLabel(unitSystem)})
        <input
          id="max-elevation-gain"
          name="maxElevationGain"
          type="number"
          min={0}
          step={1}
          value={metersToElevation(maxElevationGainMeters, unitSystem).toFixed(0)}
          onChange={(e) =>
            setMaxElevationGainMeters(elevationToMeters(Number(e.target.value), unitSystem))
          }
        />
      </label>

      <label className="checkbox" htmlFor="avoid-traffic-signals">
        <input
          id="avoid-traffic-signals"
          name="avoidTrafficSignals"
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
