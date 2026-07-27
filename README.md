# Run Map

A custom running route planner: pick a starting point, target distance, max
elevation gain, and preference for minimizing stop lights / street crossings.
Built with React + Vite + TypeScript, the Google Maps JavaScript API, and
Firebase Hosting.

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in:
   - A Google Maps API key with the **Maps JavaScript API**, **Directions
     API**, **Roads API**, and **Elevation API** enabled (Google Cloud
     Console).
   - Your Firebase web app config (Firebase Console > Project settings >
     Your apps). Firestore is wired up for saving/sharing routes later, but
     is optional to start.
3. Run the dev server:
   ```
   npm run dev
   ```

## Firebase Hosting

```
npm install -g firebase-tools
firebase login
firebase use --add   # select/create your Firebase project, creates .firebaserc (gitignored)
npm run build
firebase deploy --only hosting
```

## CI/CD

- `.github/workflows/ci.yml` runs lint + build on every PR and push to `main`.
- `.github/workflows/deploy.yml` deploys `dist/` to Firebase Hosting on push to
  `main`. Requires these repo secrets:
  - `FIREBASE_SERVICE_ACCOUNT` (JSON key for a service account with Hosting
    Admin, generated via `firebase init hosting:github` or the Firebase
    Console)
  - `FIREBASE_PROJECT_ID`
  - `VITE_GOOGLE_MAPS_API_KEY` and the `VITE_FIREBASE_*` config values from
    `.env.example`

## Project structure

```
src/
  components/   # RouteControls (form), MapView (Google Map)
  config/       # env var access
  lib/          # firebase.ts (Firestore init)
  types/        # RouteRequest / GeneratedRoute types
```

Route generation (turning a start point + preferences into an actual loop
that respects distance/elevation/crossing constraints) is stubbed out in
`App.tsx` and is the core algorithm still to be built, likely using the
Directions, Roads, and Elevation APIs together.
