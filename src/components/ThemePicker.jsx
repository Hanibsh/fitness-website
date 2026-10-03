import { Check } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { saveProfile } from '../lib/profile'
import { THEMES, setTheme, useTheme } from '../lib/theme'

// The profile page's Appearance section: one card per theme, drawn in that
// theme's own colours (page, card, ink) whatever the current theme is, so you
// can see what you're picking. Applies on tap; saved on this device, and on
// the account when signed in so your other devices follow.
export default function ThemePicker() {
  const current = useTheme()
  const { user, mergeProfile } = useAuth()

  function pick(id) {
    setTheme(id)
    if (user) {
      mergeProfile({ theme: id })
      saveProfile(user.id, { theme: id }).catch(() => {})
    }
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {THEMES.map((t) => {
        const [page, card, ink] = t.swatch
        const on = t.id === current
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => pick(t.id)}
            aria-pressed={on}
            className={`text-left p-0 cursor-pointer bg-white border transition-colors ${
              on ? 'border-text-primary' : 'border-border hover:border-border-hover'
            }`}
            style={on ? { boxShadow: '0 0 0 1px var(--color-text-primary)' } : undefined}
          >
            <span className="block p-2.5" style={{ background: page }} aria-hidden="true">
              <span className="block px-2.5 py-2" style={{ background: card, border: `1px solid ${ink}22` }}>
                <span className="block h-1.5 w-2/3 mb-1.5" style={{ background: ink }} />
                <span className="block h-1 w-full mb-1" style={{ background: ink, opacity: 0.45 }} />
                <span className="block h-1 w-4/5" style={{ background: ink, opacity: 0.45 }} />
                <span className="flex items-center justify-between mt-2">
                  <span className="inline-block h-3 w-10" style={{ background: ink }} />
                  <span className="flex gap-1">
                    {t.chart.map((c) => (
                      <span key={c} className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                    ))}
                  </span>
                </span>
              </span>
            </span>
            <span className="flex items-center justify-between gap-2 px-2.5 py-2">
              <span className="text-[12px] font-medium text-text-primary">{t.label}</span>
              {on && <Check className="w-3.5 h-3.5 text-text-primary shrink-0" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
