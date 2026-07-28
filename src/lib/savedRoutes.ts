import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import type { GeneratedRoute, LatLng, SavedRoute } from '../types/route'

function savedRoutesCollection(uid: string) {
  return collection(db, 'users', uid, 'savedRoutes')
}

export async function saveRoute(
  uid: string,
  name: string,
  route: GeneratedRoute,
  start: LatLng,
  requiredStops: LatLng[],
): Promise<void> {
  await addDoc(savedRoutesCollection(uid), {
    name,
    start,
    requiredStops,
    path: route.path,
    waypoints: route.waypoints,
    distanceMeters: route.distanceMeters,
    elevationGainMeters: route.elevationGainMeters,
    trafficSignalCount: route.trafficSignalCount,
    crossingCount: route.crossingCount,
    createdAt: serverTimestamp(),
  })
}

/** Subscribes to the user's saved routes, newest first. Returns an
 * unsubscribe function - call it on cleanup (e.g. a `useEffect` return). */
export function subscribeSavedRoutes(
  uid: string,
  onChange: (routes: SavedRoute[]) => void,
): () => void {
  const savedRoutesQuery = query(savedRoutesCollection(uid), orderBy('createdAt', 'desc'))
  return onSnapshot(savedRoutesQuery, (snapshot) => {
    onChange(
      snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data()
        return {
          id: docSnapshot.id,
          name: data.name,
          start: data.start,
          requiredStops: data.requiredStops,
          path: data.path,
          waypoints: data.waypoints,
          distanceMeters: data.distanceMeters,
          elevationGainMeters: data.elevationGainMeters,
          trafficSignalCount: data.trafficSignalCount,
          crossingCount: data.crossingCount,
          // Pending writes haven't been assigned a server timestamp yet -
          // treat them as "now" until the confirmed value arrives.
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
        } satisfies SavedRoute
      }),
    )
  })
}

export async function deleteSavedRoute(uid: string, routeId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'savedRoutes', routeId))
}
