import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import SplitWizard from '../components/SplitWizard'

// The generator inside the log, at /split/generate — reached from the training
// split list, and returning there. The same wizard is also the Programs page's
// centrepiece; the difference between the two is the framing, not the tool, so
// everything that decides anything lives in SplitWizard.
export default function GenerateSplit() {
  const navigate = useNavigate()

  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/log/split')}
          className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer text-[13px] mb-10 p-0 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to training splits
        </button>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">Generate a split</h1>
          <p className="text-text-muted text-[15px] mb-10 leading-relaxed">
            Answer three questions and the exercise database does the rest — every muscle on two to three
            sessions a week, the ones you want to bring up trained more often and first, and each day filled
            with whatever buys the most growth for the fatigue it can still afford.
          </p>

          <SplitWizard />
        </motion.div>
      </div>
    </div>
  )
}
