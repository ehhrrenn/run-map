import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { detectUnitSystem, type UnitSystem } from '../lib/units'

const STORAGE_KEY = 'run-map:unit-system'

interface UnitSystemContextValue {
  unitSystem: UnitSystem
  setUnitSystem: (system: UnitSystem) => void
}

const UnitSystemContext = createContext<UnitSystemContextValue | null>(null)

function readStoredUnitSystem(): UnitSystem | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'metric' || raw === 'imperial' ? raw : null
  } catch {
    return null
  }
}

export function UnitSystemProvider({ children }: { children: ReactNode }) {
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>(
    () => readStoredUnitSystem() ?? detectUnitSystem(),
  )

  function setUnitSystem(system: UnitSystem) {
    setUnitSystemState(system)
    try {
      localStorage.setItem(STORAGE_KEY, system)
    } catch {
      // localStorage unavailable (private browsing, quota, etc.) - selection just won't persist.
    }
  }

  const value = useMemo(() => ({ unitSystem, setUnitSystem }), [unitSystem])

  return <UnitSystemContext.Provider value={value}>{children}</UnitSystemContext.Provider>
}

export function useUnitSystem(): UnitSystemContextValue {
  const context = useContext(UnitSystemContext)
  if (!context) {
    throw new Error('useUnitSystem must be used within a UnitSystemProvider')
  }
  return context
}
