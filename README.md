# Run Map

A custom running route planner: pick a starting point, target distance, max
elevation gain, and preference for minimizing stop lights / street crossings.
Sign in with Google to name and save routes to your profile, then search,
filter, and delete them from the Saved Routes screen. Built with
React + Vite + TypeScript, the Google Maps JavaScript API, Firebase Auth,
Firestore, and Firebase Hosting.

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in:
   - A Google Maps API key with the **Maps JavaScript API**, **Routes API**,
     and **Elevation API** enabled (Google Cloud Console). If the key has API
     restrictions configured, make sure Routes API is in the allowed list.
   - Optionally, a Map ID (Cloud Console > Google Maps Platform > Map
     Management) for `VITE_GOOGLE_MAPS_MAP_ID`, needed for custom marker
     styling via `AdvancedMarker`. Defaults to Google's public demo Map ID
     (watermarked) if left unset.
   - Your Firebase web app config (Firebase Console > Project settings >
     Your apps).
3. In the Firebase Console, enable Google Sign-In:
   - **Authentication > Sign-in method**: enable the **Google** provider.
   - **Authentication > Settings > Authorized domains**: confirm your
     Hosting domain (e.g. `run-map.web.app`) and `localhost` are listed
     (Firebase adds `*.firebaseapp.com` automatically).
   - **Firestore Database**: create a database if one doesn't exist yet, in
     the same project. Security rules (`firestore.rules`) restrict each
     user's saved routes to that user only.
4. Run the dev server:
   ```
   npm run dev
   ```

## Firebase Hosting

Deploys to the `run-map` Hosting site (https://run-map.web.app/) within the
`run-map-4b0d7` project — a non-default site, set via `"site": "run-map"` in
`firebase.json`. No `.firebaserc` target mapping is needed for this; the CLI
resolves the site by name directly against whichever project is active.

```
npm install -g firebase-tools
firebase login
firebase use --add   # select/create your Firebase project, creates .firebaserc (gitignored)
npm run build
firebase deploy --only hosting
```

## CI/CD

- `.github/workflows/ci.yml` runs lint + build on every PR and push to `main`.
- `.github/workflows/deploy.yml` deploys `dist/` to Firebase Hosting and
  `firestore.rules` to Firestore on push to `main`. Requires these repo
  secrets:
  - `FIREBASE_SERVICE_ACCOUNT` (JSON key for a service account with Hosting
    Admin **and** Cloud Datastore/Firestore rules deploy permission,
    generated via `firebase init hosting:github` or the Firebase Console)
  - `FIREBASE_PROJECT_ID`
  - `VITE_GOOGLE_MAPS_API_KEY`, optionally `VITE_GOOGLE_MAPS_MAP_ID`, and the
    `VITE_FIREBASE_*` config values from `.env.example`

## Project structure

```
src/
  components/   # RouteControls (form), MapView (Google Map), TopNav,
                # PlannerScreen, SavedRoutesScreen
  config/       # env var access
  hooks/        # useRouteGenerator, useAuth, useUnitSystem, ...
  lib/          # firebase.ts (Firestore init), auth.ts, savedRoutes.ts
  types/        # RouteRequest / GeneratedRoute / SavedRoute types
```

Route generation (`src/hooks/useRouteGenerator.ts`) builds candidate loop
routes via the Routes API, scores them by elevation gain (Elevation API) and
nearby traffic signals/crossings (OpenStreetMap Overpass API). Saved routes
live in Firestore at `users/{uid}/savedRoutes/{routeId}` (`src/lib/savedRoutes.ts`),
locked down per-user by `firestore.rules`.
