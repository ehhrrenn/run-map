import { useUnitSystem } from '../hooks/useUnitSystem'

export function UnitToggle() {
  const { unitSystem, setUnitSystem } = useUnitSystem()

  return (
    <div className="unit-toggle" role="group" aria-label="Units">
      <button
        type="button"
        className={unitSystem === 'imperial' ? 'selected' : ''}
        onClick={() => setUnitSystem('imperial')}
      >
        mi / ft
      </button>
      <button
        type="button"
        className={unitSystem === 'metric' ? 'selected' : ''}
        onClick={() => setUnitSystem('metric')}
      >
        km / m
      </button>
    </div>
  )
}
