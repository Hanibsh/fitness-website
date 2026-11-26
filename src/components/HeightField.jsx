import { useEffect, useState } from 'react'
import StepperField from './StepperField'

// Height, typed or stepped. Metric is one cm box that starts at 170; imperial
// is a ft box and an in box that start at 5′5″. The value in and out is always
// ONE number — cm, or total inches — so nothing that stores or checks height
// changes.
//
// The two imperial boxes keep their own text so a half-typed height (feet in,
// inches not yet) doesn't get rewritten under you. An outside change (profile
// fill, unit switch) that doesn't match them re-splits the value.

const START_CM = 170
const START_FT = 5
const START_IN = 5

function split(total) {
  if (total === '' || total == null || !Number.isFinite(Number(total))) return { ft: '', inch: '' }
  const t = Number(total)
  const ft = Math.floor(t / 12)
  const inch = Math.round((t - ft * 12) * 10) / 10
  return { ft: String(ft), inch: String(inch) }
}

function join(ft, inch) {
  if (ft === '' && inch === '') return ''
  return String(Math.round(((Number(ft) || 0) * 12 + (Number(inch) || 0)) * 10) / 10)
}

export default function HeightField({ value, onValueChange, imperial, className = '', idPrefix = 'height' }) {
  const [parts, setParts] = useState(() => split(value))
  const canonical = value == null ? '' : String(value)

  useEffect(() => {
    if (!imperial) return
    if (join(parts.ft, parts.inch) !== canonical) setParts(split(canonical))
    // Only an outside change should re-split; our own edits already match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonical, imperial])

  if (!imperial) {
    return (
      <StepperField
        value={value ?? ''}
        onValueChange={onValueChange}
        step={1} min={100} max={250} start={START_CM}
        placeholder={String(START_CM)}
        aria-label="Height in cm"
        className={className}
      />
    )
  }

  // A step on either box from empty fills BOTH with 5′5″, so the first
  // arrow press gives a real height instead of 5′0″ or 0′5″.
  function change(which, v, how) {
    let next = { ...parts, [which]: v }
    if (how === 'step' && parts.ft === '' && parts.inch === '') {
      next = which === 'ft' ? { ft: v, inch: String(START_IN) } : { ft: String(START_FT), inch: v }
    }
    if (which === 'inch' && v !== '' && Number(v) >= 12) return
    setParts(next)
    onValueChange(join(next.ft, next.inch))
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      <div className="relative">
        <StepperField
          id={`${idPrefix}-ft`}
          decimal={false}
          value={parts.ft}
          onValueChange={(v, how) => change('ft', v, how)}
          step={1} min={3} max={8} start={START_FT}
          placeholder={String(START_FT)}
          aria-label="Height, feet"
          className={`${className} !pl-2`} arrowPad="!pr-8"
        />
        <span className="pointer-events-none absolute right-[19px] top-1/2 -translate-y-1/2 text-[11px] text-text-light">ft</span>
      </div>
      <div className="relative">
        <StepperField
          id={`${idPrefix}-in`}
          value={parts.inch}
          onValueChange={(v, how) => change('inch', v, how)}
          step={1} min={0} max={11} start={START_IN}
          placeholder={String(START_IN)}
          aria-label="Height, inches"
          className={`${className} !pl-2`} arrowPad="!pr-8"
        />
        <span className="pointer-events-none absolute right-[19px] top-1/2 -translate-y-1/2 text-[11px] text-text-light">in</span>
      </div>
    </div>
  )
}
