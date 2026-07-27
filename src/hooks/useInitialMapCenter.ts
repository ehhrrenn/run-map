import { useEffect, useState } from 'react'
import type { LatLng } from '../types/route'

const FALLBACK_CENTER: LatLng = { lat: 40.7128, lng: -74.006 } // New York City
const GEOLOCATION_TIMEOUT_MS = 5000

/** Resolves to the user's current location, falling back to a fixed default
 * on denial, error, timeout, or lack of browser support. Returns null while
 * still resolving. */
export function useInitialMapCenter(): LatLng | null {
  const [center, setCenter] = useState<LatLng | null>(null)

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setCenter(FALLBACK_CENTER)
      return
    }

    let settled = false
    function settle(value: LatLng) {
      if (settled) return
      settled = true
      setCenter(value)
    }

    // Belt-and-suspenders: some browsers never invoke either callback while
    // a permission prompt sits unanswered, so the `timeout` option alone
    // isn't reliable - a plain timer guarantees we still fall back.
    const fallbackTimer = setTimeout(() => settle(FALLBACK_CENTER), GEOLOCATION_TIMEOUT_MS)

    navigator.geolocation.getCurrentPosition(
      (position) => settle({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => settle(FALLBACK_CENTER),
      { timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 60_000 },
    )

    return () => {
      settled = true
      clearTimeout(fallbackTimer)
    }
  }, [])

  return center
}
