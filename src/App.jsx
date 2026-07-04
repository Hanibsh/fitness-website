import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import InstallPrompt from './components/InstallPrompt'

// Every page except the landing page is lazy-loaded so first paint doesn't
// pay for calculators and the tracker up front.
const Tools = lazy(() => import('./pages/Tools'))
const Programs = lazy(() => import('./pages/Programs'))
const Contact = lazy(() => import('./pages/Contact'))
const TDEECalculator = lazy(() => import('./pages/tools/TDEECalculator'))
const OneRepMax = lazy(() => import('./pages/tools/OneRepMax'))
const ProteinCalculator = lazy(() => import('./pages/tools/ProteinCalculator'))
const CreatineCalculator = lazy(() => import('./pages/tools/CreatineCalculator'))
const StrengthStandards = lazy(() => import('./pages/tools/StrengthStandards'))
const CalorieDeficit = lazy(() => import('./pages/tools/CalorieDeficit'))
const FFMICalculator = lazy(() => import('./pages/tools/FFMICalculator'))
const MuscleGainPotential = lazy(() => import('./pages/tools/MuscleGainPotential'))
const WorkoutTracker = lazy(() => import('./pages/WorkoutTracker'))
const Account = lazy(() => import('./pages/Account'))
const Privacy = lazy(() => import('./pages/Privacy'))

function App() {
  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <Suspense fallback={<div className="pt-28 px-6 text-center text-[13px] text-text-muted">Loading…</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/log" element={<WorkoutTracker />} />
        <Route path="/account" element={<Account />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/programs" element={<Programs />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/tools/tdee" element={<TDEECalculator />} />
        <Route path="/tools/one-rep-max" element={<OneRepMax />} />
        <Route path="/tools/protein" element={<ProteinCalculator />} />
        <Route path="/tools/creatine" element={<CreatineCalculator />} />
        <Route path="/tools/strength-standards" element={<StrengthStandards />} />
        <Route path="/tools/calorie-deficit" element={<CalorieDeficit />} />
        <Route path="/tools/ffmi" element={<FFMICalculator />} />
        <Route path="/tools/muscle-potential" element={<MuscleGainPotential />} />
      </Routes>
      </Suspense>
      <InstallPrompt />
    </div>
  )
}

export default App
