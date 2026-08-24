import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import InstallPrompt from './components/InstallPrompt'
import { useAuth } from './lib/auth'

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
const TrainingSplit = lazy(() => import('./pages/TrainingSplit'))
const SplitLayout = lazy(() => import('./pages/SplitLayout'))
const SplitOverview = lazy(() => import('./pages/SplitOverview'))
const SplitDay = lazy(() => import('./pages/SplitDay'))
const GenerateSplit = lazy(() => import('./pages/GenerateSplit'))

// The routine builder became the "Training split" tab of the log (2026-07).
// Old /routine URLs (bookmarks, synced devices mid-deploy) land on the new ones.
function LegacyRoutineRedirect() {
  const { id } = useParams()
  return <Navigate to={`/split/${id}`} replace />
}
const Account = lazy(() => import('./pages/Account'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Exercises = lazy(() => import('./pages/Exercises'))
const ExerciseCategory = lazy(() => import('./pages/ExerciseCategory'))
const ExerciseDetail = lazy(() => import('./pages/ExerciseDetail'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))

function App() {
  const { user, loading } = useAuth()
  // Logged-in users land on their dashboard; everyone else gets the marketing
  // home. While auth is resolving, show Home to avoid a flash of empty state.
  const homeElement = user && !loading ? <Dashboard /> : <Home />
  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <Suspense fallback={<div className="pt-28 px-6 text-center text-[13px] text-text-muted">Loading…</div>}>
      <Routes>
        <Route path="/" element={homeElement} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/exercises" element={<Exercises />} />
        <Route path="/exercises/group/:cat" element={<ExerciseCategory />} />
        <Route path="/exercises/group/:cat/:sub" element={<ExerciseCategory />} />
        <Route path="/exercises/:id" element={<ExerciseDetail />} />
        <Route path="/log" element={<WorkoutTracker />} />
        <Route path="/log/split" element={<TrainingSplit />} />
        <Route path="/calendar" element={<CalendarPage />} />
        {/* One split, three levels: the list at /log/split, this split's days as
            cards, then one day's exercises. Nested so SplitLayout holds the
            split's data across the transition instead of refetching per page. */}
        {/* Ahead of /split/:id on purpose — a static segment out-ranks the
            dynamic one, so "generate" never reaches SplitLayout the way "new"
            deliberately does. */}
        <Route path="/split/generate" element={<GenerateSplit />} />
        <Route path="/split/:id" element={<SplitLayout />}>
          <Route index element={<SplitOverview />} />
          <Route path="day/:dayId" element={<SplitDay />} />
        </Route>
        <Route path="/routine" element={<Navigate to="/log/split" replace />} />
        <Route path="/routine/:id" element={<LegacyRoutineRedirect />} />
        <Route path="/account" element={<Account />} />
        <Route path="/profile" element={<Account />} />
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
