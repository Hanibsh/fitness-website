import { useState } from 'react'

// A numeric field that parses its own input instead of handing the job to the
// browser.
//
// `<input type="number">` looked like the obvious choice and was quietly
// destroying data. It parses against the BROWSER's locale, and when what you
// type disagrees with that locale it doesn't reject the value — it drops the
// separator and closes the gap. Typing `10,5` on a German keyboard in an
// en-US browser reads back as `"105"`, with `validity.badInput` false, because
// 105 is a perfectly good number. Nothing downstream can tell that a bar weight
// was multiplied by ten: it lands in the log, the volume, the est. 1RM and the
// PRs, and it stays there.
//
// Sanitising afterwards is impossible — the comma is gone before any handler
// runs. So the field takes the parsing back. `type="text"` means the keystrokes
// arrive intact; `inputMode` still chooses the phone keypad, so nothing changes
// under your thumb, and the iOS 16px anti-zoom rule in index.css still matches
// (it selects `input`, not a type).
//
// Losing `min`/`max`/`step` costs nothing real: nothing in the app ever read
// `valueAsNumber` or called `stepUp`, and browsers don't enforce `max` on typing
// anyway. `negative` is the one that mattered — it's what `min="0"` was trying
// to say — and refusing a minus sign as it's typed enforces it for the first
// time, while the bodyweight "added" field opts back in for assisted reps.

// Digits, at most one separator, and a leading minus only where it's allowed.
// Keeps WHICHEVER separator was typed, so the field can show you your own comma
// while the value behind it stays canonical.
function filterNumeric(raw, { decimal = true, negative = false } = {}) {
  let out = ''
  let seenSeparator = false
  for (const c of String(raw ?? '')) {
    if (c === '-') {
      if (negative && out === '') out += c
    } else if (c === '.' || c === ',') {
      if (decimal && !seenSeparator) { seenSeparator = true; out += c }
    } else if (c >= '0' && c <= '9') {
      out += c
    }
  }
  return out
}

// Display form → the form everything else in the app reads with `Number()`.
const toStored = (display) => display.replace(',', '.')

export default function NumberField({
  value,
  onValueChange,
  decimal = true,
  negative = false,
  inputMode,
  ...rest
}) {
  // What you typed, kept only while it still means the number that's stored.
  // Without this the field would rewrite your comma to a period under your
  // thumb on every keystroke, since the value coming back down is canonical.
  // Comparing through `toStored` is also what lets a change from ELSEWHERE —
  // "Same as last time", a kg↔lbs switch, a fill from the hint bar — win: it
  // won't match the buffer, so the incoming value is shown instead.
  const [typed, setTyped] = useState(null)
  const canonical = value == null ? '' : String(value)
  const shown = typed != null && toStored(typed) === canonical ? typed : canonical

  return (
    <input
      {...rest}
      type="text"
      inputMode={inputMode || (decimal ? 'decimal' : 'numeric')}
      value={shown}
      onChange={(e) => {
        const display = filterNumeric(e.target.value, { decimal, negative })
        setTyped(display)
        const stored = toStored(display)
        if (stored !== canonical) onValueChange(stored)
      }}
    />
  )
}
