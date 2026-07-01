import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Tools from './pages/Tools'
import Programs from './pages/Programs'
import Contact from './pages/Contact'
import TDEECalculator from './pages/tools/TDEECalculator'
import OneRepMax from './pages/tools/OneRepMax'
import ProteinCalculator from './pages/tools/ProteinCalculator'
import CreatineCalculator from './pages/tools/CreatineCalculator'
import StrengthStandards from './pages/tools/StrengthStandards'
import CalorieDeficit from './pages/tools/CalorieDeficit'

function App() {
  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/programs" element={<Programs />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/tools/tdee" element={<TDEECalculator />} />
        <Route path="/tools/one-rep-max" element={<OneRepMax />} />
        <Route path="/tools/protein" element={<ProteinCalculator />} />
        <Route path="/tools/creatine" element={<CreatineCalculator />} />
        <Route path="/tools/strength-standards" element={<StrengthStandards />} />
        <Route path="/tools/calorie-deficit" element={<CalorieDeficit />} />
      </Routes>
    </div>
  )
}

export default App
