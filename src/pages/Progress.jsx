import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import ProgressView from '../components/ProgressView'
import { useMyCoach } from '../lib/useMyCoach'
import { useMyProgressData } from '../lib/useMyProgressData'

// Your progress over time — /progress, opened from the dashboard's Progress
// card: strength, bodyweight, body fat, lean mass, calories and protein on one
// timeline. The same view your coach sees on their side.
export default function Progress() {
  const { coach } = useMyCoach()
  const data = useMyProgressData(coach)

  return (
    <div className="pt-24 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary no-underline text-[13px] mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
        </Link>
        <h1 className="font-heading text-3xl sm:text-4xl font-medium text-text-primary mb-6">Progress</h1>
        <section className="bg-white border border-border p-5 sm:p-7">
          {data.loading ? (
            <p className="text-[13px] text-text-muted">Loading…</p>
          ) : (
            <ProgressView sessions={data.sessions} bodyweight={data.bodyweight} weekly={data.weekly} targets={data.targets} unit={data.unit} />
          )}
        </section>
      </div>
    </div>
  )
}
