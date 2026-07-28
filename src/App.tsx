import { Route, Routes } from 'react-router'
import { APIProvider } from '@vis.gl/react-google-maps'
import { TopNav } from './components/TopNav'
import { PlannerScreen } from './components/PlannerScreen'
import { SavedRoutesScreen } from './components/SavedRoutesScreen'
import { AuthProvider } from './hooks/useAuth'
import { UnitSystemProvider } from './hooks/useUnitSystem'
import { GOOGLE_MAPS_API_KEY } from './config/env'
import './App.css'

function App() {
  return (
    <UnitSystemProvider>
      <AuthProvider>
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
          <div className="app-shell">
            <TopNav />
            <div className="app-content">
              <Routes>
                <Route path="/" element={<PlannerScreen />} />
                <Route path="/saved" element={<SavedRoutesScreen />} />
              </Routes>
            </div>
          </div>
        </APIProvider>
      </AuthProvider>
    </UnitSystemProvider>
  )
}

export default App
