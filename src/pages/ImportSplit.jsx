import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import ImportReview from '../components/ImportReview'
import { useAuth } from '../lib/auth'
import { useProgramsState } from '../lib/useProgramsState'
import { saveProfile } from '../lib/profile'
import { useReturnLink } from '../lib/returnPath'

// Bring an exported split back in — /import. The text someone was sent (or
// exported themselves) becomes a split in their list, and, if they want, fills
// in their profile. No account needed for the split; the profile part needs one.
export default function ImportSplit() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const { addRoutine, setActiveRoutine, loading } = useProgramsState()
  const [makeActive, setMakeActive] = useState(true)
  const [error, setError] = useState('')
  // Linked from Programs and the profile — back goes to whichever.
  const back = useReturnLink('import', { to: '/programs', label: 'Back to programs' })

  async function importIt({ program, profile: patch }) {
    setError('')
    if (patch && user) {
      try {
        await saveProfile(user.id, patch)
        await refreshProfile()
      } catch {
        setError('Your profile couldn’t be saved just now — the split is still imported. Try the profile again later.')
      }
    }
    if (program) {
      addRoutine(program)
      if (makeActive) setActiveRoutine(program.id)
      // Replace, not push: the phone's back button shouldn't land on a used
      // import form.
      navigate(`/split/${program.id}`, { replace: true })
    } else if (patch && user) {
      navigate('/account', { replace: true })
    }
  }

  return (
    <div className="pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to={back.to} state={back.state} className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-10 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> {back.label}
        </Link>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-4xl font-medium text-text-primary mb-3">Import a split</h1>
          <p className="text-text-muted text-[15px] mb-10 leading-relaxed">
            Open the .txt file you were sent, or paste its text — a program from your coach, or one exported from
            this site. You&apos;ll see every day and every profile detail it holds before anything is saved, and
            you choose which profile details to keep.
          </p>

          <div className="bg-white border border-border p-5 sm:p-7">
            {loading ? (
              <p className="text-[13px] text-text-muted">Loading…</p>
            ) : (
              <>
                <label className="flex items-center gap-2.5 mb-5 cursor-pointer select-none text-[13px] text-text-secondary">
                  <input
                    type="checkbox"
                    checked={makeActive}
                    onChange={(e) => setMakeActive(e.target.checked)}
                    className="w-4 h-4 shrink-0 accent-text-primary cursor-pointer"
                  />
                  Make it the split my log follows
                </label>
                <ImportReview currentProfile={profile} canSaveProfile={!!user} importLabel="Import" onImport={importIt} />
              </>
            )}
            {error && <p className="text-[12px] text-amber-600 mt-3">{error}</p>}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
