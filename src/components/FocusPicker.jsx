import { useState } from 'react'
import { MAX_FOCUS_MUSCLES } from '../lib/generatorConfig'
import { FOCUS_OPTIONS } from '../lib/profileFields'
import { zoneMuscles, zoneSlugForEngineMuscle } from '../data/anatomyRegions'
import InteractiveAnatomy from './InteractiveAnatomy'

// The muscles someone wants brought up: a pick of up to MAX_FOCUS_MUSCLES.
// Shared by the split wizard and the profile page, which stores the pick
// (`profiles.focus_muscles`) so every new split starts from it.
//
// Picked on the anatomy map first: tap a label and its muscle toggles. A label
// that stands for several muscles — Shoulders, Core, and Lats, which also
// carries Upper Back since the art has no label for it — opens a close-up of
// them under the figure instead. The plain list underneath picks the same
// muscles, for anyone who'd rather read than tap a body, and is the whole
// picker if the art fails to load.
const zoneOf = (muscle) => zoneSlugForEngineMuscle(muscle) || (muscle === 'Upper Back' ? 'lats' : null)

export default function FocusPicker({ value, onChange }) {
  const [closeUp, setCloseUp] = useState(null)
  const [note, setNote] = useState('')
  const full = value.length >= MAX_FOCUS_MUSCLES

  function toggle(m) {
    if (value.includes(m)) onChange(value.filter((x) => x !== m))
    else if (full) return setNote(`Up to ${MAX_FOCUS_MUSCLES} — take one off to add ${m}.`)
    else onChange([...value, m])
    setNote('')
  }

  function pickZone(zone) {
    const muscles = zoneMuscles(zone.slug)
    if (muscles.length === 1) {
      setCloseUp(null)
      toggle(muscles[0])
    } else {
      setNote('')
      setCloseUp(closeUp?.slug === zone.slug ? null : zone)
    }
  }

  return (
    <div>
      <InteractiveAnatomy
        onSelect={pickZone}
        selected={value.map(zoneOf).filter(Boolean)}
        viewToggle
        hint="Tap a muscle to bring it up"
        className="mb-4"
      >
        <div className="mt-3 min-h-[2.5rem] text-center" aria-live="polite">
          {closeUp && (
            <>
              <p className="text-[12px] text-[#c7c6c0] mb-2">{closeUp.label}, up close:</p>
              <div className="flex flex-wrap justify-center gap-1.5 mb-2">
                {zoneMuscles(closeUp.slug).map((m) => {
                  const on = value.includes(m)
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggle(m)}
                      aria-pressed={on}
                      className={`text-[12px] px-3 py-1.5 rounded-full cursor-pointer border transition-colors ${
                        on
                          ? 'bg-[#efc65b] text-[#101116] border-[#efc65b] font-medium'
                          : 'bg-transparent text-[#c7c6c0] border-[#33353f] hover:border-[#efc65b]'
                      }`}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
            </>
          )}
          <p className="text-[12px] text-[#efc65b]">
            {note || (value.length ? `${value.join(' · ')} — ${value.length} of ${MAX_FOCUS_MUSCLES}` : `Pick up to ${MAX_FOCUS_MUSCLES}`)}
          </p>
        </div>
      </InteractiveAnatomy>

      <p className="text-[11px] uppercase tracking-wider text-text-light mb-2">Or from the list</p>
      <div className="flex flex-wrap gap-1.5">
        {FOCUS_OPTIONS.map((m) => {
          const on = value.includes(m)
          return (
            <button
              key={m}
              type="button"
              onClick={() => toggle(m)}
              disabled={!on && full}
              aria-pressed={on}
              className={`px-2.5 py-1.5 text-[12px] font-medium border cursor-pointer transition-colors ${
                on
                  ? 'bg-text-primary text-cream border-text-primary'
                  : 'bg-white text-text-muted border-border hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {m}
            </button>
          )
        })}
      </div>
    </div>
  )
}
