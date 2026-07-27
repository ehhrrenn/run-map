export type UnitSystem = 'metric' | 'imperial'

const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']) // United States, Liberia, Myanmar
const METERS_PER_MILE = 1609.344
const METERS_PER_FOOT = 0.3048

export function detectUnitSystem(): UnitSystem {
  try {
    const locale = navigator.language
    const region = locale.split('-')[1]?.toUpperCase()
    return region && IMPERIAL_REGIONS.has(region) ? 'imperial' : 'metric'
  } catch {
    return 'metric'
  }
}

export function metersToDistance(meters: number, system: UnitSystem): number {
  return system === 'imperial' ? meters / METERS_PER_MILE : meters / 1000
}

export function distanceToMeters(value: number, system: UnitSystem): number {
  return system === 'imperial' ? value * METERS_PER_MILE : value * 1000
}

export function metersToElevation(meters: number, system: UnitSystem): number {
  return system === 'imperial' ? meters / METERS_PER_FOOT : meters
}

export function elevationToMeters(value: number, system: UnitSystem): number {
  return system === 'imperial' ? value * METERS_PER_FOOT : value
}

export function distanceUnitLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'mi' : 'km'
}

export function elevationUnitLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'ft' : 'm'
}
