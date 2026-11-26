import WheelField, { range } from './WheelPicker'

// Height on a wheel. Metric is one cm wheel that opens on 170; imperial is a
// ft wheel beside an in wheel, opening on 5′5″. The value in and out is always
// ONE number, cm or total inches, so nothing that stores or checks height
// changes.

const CM = range(100, 250)
const FT = range(3, 8)
const IN = range(0, 11)
const START_CM = 170
const START_IN_TOTAL = 65 // 5′5″

const fmt = (n) => String(Math.round(n * 10) / 10)

export default function HeightField({ value, onValueChange, imperial, className = '' }) {
  const blank = value === '' || value == null || !Number.isFinite(Number(value))

  if (!imperial) {
    return (
      <WheelField
        title="Height"
        aria-label="Height in cm"
        columns={[{ values: CM, current: blank ? START_CM : Number(value), suffix: ' cm', label: 'Centimetres' }]}
        blank={blank}
        display={`${fmt(Number(value))} cm`}
        placeholder={`${START_CM} cm`}
        onPick={([cm]) => onValueChange(String(cm))}
        onClear={() => onValueChange('')}
        className={className}
      />
    )
  }

  const total = blank ? START_IN_TOTAL : Number(value)
  const ft = Math.floor(total / 12)
  const inch = total - ft * 12
  return (
    <WheelField
      title="Height"
      aria-label="Height in feet and inches"
      columns={[
        { values: FT, current: ft, suffix: ' ft', label: 'Feet' },
        { values: IN, current: inch, suffix: ' in', label: 'Inches' },
      ]}
      blank={blank}
      display={`${ft} ft ${fmt(inch)} in`}
      placeholder="5 ft 5 in"
      onPick={([f, i]) => onValueChange(String(f * 12 + i))}
      onClear={() => onValueChange('')}
      className={className}
    />
  )
}
