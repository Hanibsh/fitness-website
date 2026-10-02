import { Link } from 'react-router-dom'

// Shown on a calculator once it has seeded itself from the signed-in user's
// profile. Inputs that fill themselves are confusing without a word of
// explanation — this says where the numbers came from and that they're yours to
// change. Renders nothing for guests, or when there was nothing to prefill.
// `log` adds the training log as a source, for the calculators that work out
// weekly training hours from it.
export default function PrefillNote({ from, log = false }) {
  if (!from && !log) return null
  return (
    <p className="text-[11px] text-text-light">
      Filled in from{' '}
      {from && (
        <Link to="/account" className="text-text-muted underline underline-offset-2 hover:text-text-primary">
          your profile
        </Link>
      )}
      {from && log && ' and '}
      {log && 'the sessions you’ve logged'}
      . Change anything here — it won't touch your saved details.
    </p>
  )
}
