import { useState } from 'react'
import NumberField from './NumberField'
import {
  CARDIO_ACTIVITIES, activityById, strokeById, kmhToMph, mphToKmh, stairLevelToSpm, wattsToSplit,
  defaultCardioParams, sessionMinutes, sessionKcal, DEFAULT_CARDIO_TARGET,
} from '../lib/cardio'

// One cardio prescription, editable: the machine's settings and how much per
// session — minutes or calories, with the other worked out from bodyweight. The
// split editor's cardio rows and the split generator's cardio planner both use
// it, so both write the same shape (lib/cardio.js).
//
//   value          { activity, params, target }
//   onChange(next) the whole next value
//   unit           'kg' | 'lbs' — speed shows in km/h or mph to match
//   weightKg       for the ≈ half; without it only the target shows
//   chooseActivity show the activity picker (the planner). A split row's
//                  activity follows its movement instead, changed by swapping.
//   label          prefixes the inputs' accessible names
//
// Compact on purpose: it sits inside a DayEditor row on a 320px phone.

const inputCls = 'bg-cream border border-border px-1 py-1.5 text-center text-text-primary text-[13px] outline-none focus:border-text-primary transition-colors'
const tagCls = 'text-[10px] uppercase tracking-wider text-text-light'
const round1 = (n) => Math.round(n * 10) / 10

function Chip({ active, onClick, children, sub }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`px-2 py-1 text-[11px] font-medium border cursor-pointer transition-colors leading-tight ${
        active ? 'bg-text-primary text-cream border-text-primary' : 'bg-white text-text-muted border-border hover:border-border-hover'
      }`}
    >
      {children}
      {sub && <span className={`block text-[9px] font-normal ${active ? 'text-cream-70' : 'text-text-light'}`}>{sub}</span>}
    </button>
  )
}

// A decimal stored in one unit and shown in another (speed: km/h stored, mph
// shown). Keeps what you typed while it still means the stored number, so "3."
// lives long enough to become 3.5 instead of snapping back to "3".
function MeasureField({ stored, toShown = (n) => n, fromShown = (n) => n, onStored, ...rest }) {
  const [typed, setTyped] = useState(null)
  const empty = stored === '' || stored == null
  const derived = empty ? '' : String(round1(toShown(Number(stored))))
  const stillTyped = typed != null && (typed === '' ? empty : !empty && Math.abs(fromShown(Number(typed)) - Number(stored)) < 1e-9)
  return (
    <NumberField
      {...rest}
      value={stillTyped ? typed : derived}
      onValueChange={(v) => {
        setTyped(v)
        onStored(v === '' || !Number.isFinite(Number(v)) ? '' : fromShown(Number(v)))
      }}
    />
  )
}

// A whole number stored as a number, '' while empty.
function IntField({ value, onValue, ...rest }) {
  return <NumberField {...rest} decimal={false} value={value ?? ''} onValueChange={(v) => onValue(v === '' ? '' : Number(v))} />
}

export default function CardioFields({ value, onChange, unit = 'kg', weightKg = null, chooseActivity = false, label = 'Cardio' }) {
  const a = activityById[value.activity]
  const p = value.params || {}
  const t = value.target || DEFAULT_CARDIO_TARGET
  const imperial = unit === 'lbs' || unit === 'imperial'
  const setParams = (patch) => onChange({ ...value, params: { ...p, ...patch } })
  const setTarget = (patch) => onChange({ ...value, target: { ...t, ...patch } })

  // Minutes ⇄ calories keeps the session the same where bodyweight allows;
  // without one there's nothing to convert with, so it starts from a typical
  // amount instead of reading 20 minutes as 20 calories.
  function pickBy(by) {
    if (by === t.by) return
    const same = by === 'kcal' ? sessionKcal(value, weightKg) : sessionMinutes(value, weightKg)
    const next = same ? (by === 'kcal' ? Math.round(same / 5) * 5 : Math.round(same)) : by === 'kcal' ? 150 : 20
    setTarget({ by, value: next })
  }
  const other = t.by === 'kcal' ? sessionMinutes(value, weightKg) : sessionKcal(value, weightKg)

  let settings = null
  if (a?.kind === 'speed') {
    settings = (
      <>
        <div className="flex items-center gap-1.5">
          <span className={tagCls}>{imperial ? 'mph' : 'km/h'}</span>
          <MeasureField
            stored={p.speedKmh}
            toShown={imperial ? kmhToMph : undefined}
            fromShown={imperial ? mphToKmh : undefined}
            onStored={(v) => setParams({ speedKmh: v })}
            aria-label={`${label} speed in ${imperial ? 'mph' : 'km/h'}`}
            className={`w-14 ${inputCls}`}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={tagCls}>Incline %</span>
          <MeasureField stored={p.gradePct ?? 0} onStored={(v) => setParams({ gradePct: v })} aria-label={`${label} incline percent`} className={`w-12 ${inputCls}`} />
        </div>
        {value.activity === 'run' && (
          <div className="flex gap-1">
            <Chip active={!p.outdoors} onClick={() => setParams({ outdoors: false })}>Treadmill</Chip>
            <Chip active={!!p.outdoors} onClick={() => setParams({ outdoors: true })}>Outdoors</Chip>
          </div>
        )}
      </>
    )
  } else if (a?.kind === 'watts' || a?.kind === 'row') {
    settings = (
      <div className="flex items-center gap-1.5">
        <span className={tagCls}>Watts</span>
        <IntField value={p.watts} onValue={(v) => setParams({ watts: v })} aria-label={`${label} watts`} className={`w-14 ${inputCls}`} />
        {a.kind === 'row' && Number(p.watts) > 0 && (
          <span className="text-[11px] text-text-light">≈ {splitClock(wattsToSplit(Number(p.watts)))} /500 m</span>
        )}
      </div>
    )
  } else if (a?.kind === 'steps') {
    settings = (
      <div className="flex items-center gap-1.5">
        <span className={tagCls}>Level</span>
        <IntField value={p.level} onValue={(v) => setParams({ level: v })} aria-label={`${label} machine level`} className={`w-12 ${inputCls}`} />
        {Number(p.level) >= a.level.min && Number(p.level) <= a.level.max && (
          <span className="text-[11px] text-text-light">≈ {Math.round(stairLevelToSpm(Number(p.level)))} steps/min</span>
        )}
      </div>
    )
  } else if (a?.kind === 'stroke') {
    const stroke = strokeById(a, p.stroke)
    settings = (
      <div className="space-y-1.5 w-full">
        <div className="flex flex-wrap gap-1">
          {a.strokes.map((s) => (
            <Chip key={s.id} active={stroke.id === s.id} onClick={() => setParams({ stroke: s.id, level: Math.min(p.level ?? 0, s.levels.length - 1) })}>{s.label}</Chip>
          ))}
        </div>
        {stroke.levels.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {stroke.levels.map((l, i) => (
              <Chip key={l.label} active={(p.level ?? 0) === i} onClick={() => setParams({ level: i })} sub={l.sub}>{l.label}</Chip>
            ))}
          </div>
        )}
      </div>
    )
  } else if (a?.kind === 'level' && a.levels.length > 1) {
    settings = (
      <div className="flex flex-wrap gap-1">
        {a.levels.map((l, i) => (
          <Chip key={l.label} active={(p.level ?? 0) === i} onClick={() => setParams({ level: i })} sub={l.sub}>{l.label}</Chip>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {chooseActivity && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {CARDIO_ACTIVITIES.map((x) => (
            <Chip key={x.id} active={value.activity === x.id} onClick={() => x.id !== value.activity && onChange({ ...value, activity: x.id, params: defaultCardioParams(x.id) })}>
              {x.label}
            </Chip>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <div className="inline-flex">
          <Chip active={t.by !== 'kcal'} onClick={() => pickBy('minutes')}>Minutes</Chip>
          <Chip active={t.by === 'kcal'} onClick={() => pickBy('kcal')}>Calories</Chip>
        </div>
        <IntField
          value={t.value}
          onValue={(v) => setTarget({ value: v })}
          aria-label={`${label} ${t.by === 'kcal' ? 'calories' : 'minutes'} per session`}
          className={`w-14 ${inputCls}`}
        />
        {other ? (
          <span className="text-[11px] text-text-light">
            ≈ {t.by === 'kcal' ? `${Math.round(other)} min` : `${Math.round(other / 5) * 5} cal`}
          </span>
        ) : null}
      </div>
      {settings && <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{settings}</div>}
    </div>
  )
}

function splitClock(sec) {
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
