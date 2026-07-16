import { Link } from 'react-router-dom'

// Shown on a calculator once it has seeded itself from the signed-in user's
// profile. Inputs that fill themselves are confusing without a word of
// explanation — this says where the numbers came from and that they're yours to
// change. Renders nothing for guests, or when there was nothing to prefill.
export default function PrefillNote({ from }) {
  if (!from) return null
  return (
    <p className="text-[11px] text-text-light">
      Filled in from{' '}
      <Link to="/account" className="text-text-muted underline underline-offset-2 hover:text-text-primary">
        your profile
      </Link>
      . Change anything here — it won't touch your saved details.
    </p>
  )
}
