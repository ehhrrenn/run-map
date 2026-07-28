import { useState } from 'react'
import type { RoutePriority, RouteRequest } from '../types/route'
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
  onSubmit: (request: Omit<RouteRequest, 'start' | 'requiredStops'>) => void
  disabled?: boolean
}

const DEFAULT_DISTANCE_METERS = distanceToMeters(3.1, 'imperial')
const DEFAULT_MAX_ELEVATION_GAIN_METERS = 50

export function RouteControls({ onSubmit, disabled }: RouteControlsProps) {
  const { unitSystem } = useUnitSystem()
  const [distanceMeters, setDistanceMeters] = useState(DEFAULT_DISTANCE_METERS)
  const [maxElevationGainMeters, setMaxElevationGainMeters] = useState(
    DEFAULT_MAX_ELEVATION_GAIN_METERS,
  )
  const [routePriority, setRoutePriority] = useState<RoutePriority>('traffic')

  return (
    <form
      className="route-controls"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ distanceMeters, maxElevationGainMeters, routePriority })
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
          value={metersToDistance(distanceMeters, unitSystem).toFixed(1)}
          onChange={(e) => {
            const rounded = Math.round(Number(e.target.value) * 10) / 10
            setDistanceMeters(distanceToMeters(rounded, unitSystem))
          }}
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

      <label htmlFor="route-priority">
        Prioritize
        <select
          id="route-priority"
          name="routePriority"
          value={routePriority}
          onChange={(e) => setRoutePriority(e.target.value as RoutePriority)}
        >
          <option value="traffic">Least stop lights / crossings</option>
          <option value="elevation">Least elevation gain</option>
          <option value="turns">Least turns / instructions</option>
        </select>
      </label>

      <button type="submit" disabled={disabled}>
        Generate route
      </button>
    </form>
  )
}
