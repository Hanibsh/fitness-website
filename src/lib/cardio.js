// Cardio energy cost, shared by the Cardio calculator and the TDEE page's
// "burn more" box so both always quote the same minutes.
//
// Everything here is NET — calories above what you'd burn sitting still. Your
// resting burn is already in your TDEE, so counting gross calories would
// double-count it and flatter cardio by 15-30%.
//
// Where each number comes from:
//   Walking, running, cycling — the ACSM metabolic equations, which take speed,
//     incline and watts directly. Running outdoors adds 1% grade for air
//     resistance from 10.5 km/h (Jones & Doust 1996).
//   Stair climber — ACSM's cost of climbing (1.8 ml O2 per kg per metre, the
//     vertical term in both its walking and stepping equations) on a
//     StairMaster's 8-inch steps. It lands on the Compendium's 9.3 MET "stair
//     treadmill, general" at about 79 steps/min, so the two agree.
//   Rowing — Concept2's monitor formula, with their bodyweight adjustment.
//   Heart rate — Keytel et al. 2005, for any activity.
//   Everything else — MET values from the 2024 Adult Compendium of Physical
//     Activities (Herrmann et al.); a MET there is gross, so one MET (rest)
//     comes off.

const ML_O2_PER_MET = 3.5
const KCAL_PER_L_O2 = 5
const KGM_PER_WATT = 6.12 // kg·m/min per watt, for the cycling equation
const CLIMB_ML_O2_PER_KG_M = 1.8 // ACSM: oxygen per kg for each metre climbed
const KG_PER_LB = 0.453592
const KJ_PER_KCAL = 4.184

export const kmhToMs = (kmh) => kmh / 3.6
export const kmhToMph = (kmh) => kmh / 1.609344
export const mphToKmh = (mph) => mph * 1.609344

// What a person burns sitting still, per minute: one MET.
const restingKcalPerMin = (kg) => (ML_O2_PER_MET * kg * KCAL_PER_L_O2) / 1000

// Net VO2 (ml/kg/min) above rest. Speed in m/min, grade as a fraction.
const walkNetVO2 = (s, g) => 0.1 * s + CLIMB_ML_O2_PER_KG_M * s * g
const runNetVO2 = (s, g) => 0.2 * s + 0.9 * s * g
// The leg-cycling equation's extra 3.5 is the cost of pedalling with no load,
// which is real work above rest, so it stays.
const bikeNetVO2 = (watts, kg) => (1.8 * watts * KGM_PER_WATT) / kg + ML_O2_PER_MET

// Outdoors, air resistance starts to cost something a treadmill doesn't from
// about 10.5 km/h; 1% grade covers it from there to 18 km/h.
export const OUTDOOR_RUN_FROM_KMH = 10.5

// A stair climber's level is its speed, not a resistance — your bodyweight is
// the load. The cost is the climb itself: 1.8 ml O2 per kg per metre of rise.
const stairNetVO2 = (spm, stepM) => CLIMB_ML_O2_PER_KG_M * stepM * spm

// Concept2's monitor: kcal/h = 4 × 0.8604 × watts + 300, i.e. ~25% efficiency
// at the handle plus a 175 lb rower's cost of moving on the slide and resting.
// Their calorie calculator swaps that 300 for 1.714 kcal/h per lb of
// bodyweight. Gross, so the resting burn comes off afterwards.
const rowGrossKcalPerMin = (watts, kg) => (4 * 0.8604 * watts + 1.714 * (kg / KG_PER_LB)) / 60

// The monitor's split (seconds per 500 m) and its watts are the same number:
// watts = 2.80 / (seconds per metre)³.
export const splitToWatts = (secPer500) => 2.8 / Math.pow(secPer500 / 500, 3)
export const wattsToSplit = (watts) => 500 * Math.cbrt(2.8 / watts)

// `kind` picks the inputs an activity takes:
//   speed  — speed + incline (ACSM). Speed limits keep each equation inside
//            the range it was built for (walking 50-100 m/min, running above
//            ~130 m/min, with some overlap for brisk walkers and slow joggers).
//   watts  — power on the console (ACSM cycling)
//   row    — rower watts, or a split that converts to them (Concept2)
//   steps  — StairMaster level or steps/min. StepMill and Gauntlet both run
//            26-162 steps/min across levels 1-20 on 8-inch steps; the levels
//            are taken as evenly spaced across that range.
//   level  — one of the Compendium entries
//   stroke — a swimming stroke, then one of its Compendium entries
export const CARDIO_ACTIVITIES = [
  { id: 'walk', label: 'Walking', kind: 'speed', speedKmh: { min: 2.5, max: 7, default: 5.5 }, grade: { max: 15, default: 0 } },
  { id: 'run', label: 'Running', kind: 'speed', speedKmh: { min: 6, max: 20, default: 9 }, grade: { max: 10, default: 0 } },
  { id: 'bike', label: 'Stationary bike', kind: 'watts', watts: { min: 25, max: 400, default: 100 } },
  { id: 'row', label: 'Rowing machine', kind: 'row', watts: { min: 30, max: 500, default: 100 } },
  { id: 'elliptical', label: 'Elliptical', kind: 'level', levels: [
    { label: 'Moderate', sub: 'can talk in sentences', met: 5.0 },
    { label: 'Vigorous', sub: 'a few words at a time', met: 9.0 },
  ] },
  { id: 'stairs', label: 'Stair climber', kind: 'steps', stepM: 0.2032, level: { min: 1, max: 20, default: 6 }, spm: { min: 26, max: 162 } },
  { id: 'swim', label: 'Swimming laps', kind: 'stroke', strokes: [
    { id: 'free', label: 'Freestyle', levels: [
      { label: 'Easy', sub: 'slow, steady laps', met: 5.8 },
      { label: 'Hard', sub: 'fast, vigorous', met: 9.8 },
    ] },
    { id: 'back', label: 'Backstroke', levels: [
      { label: 'Easy', sub: 'recreational', met: 4.8 },
      { label: 'Hard', sub: 'training pace', met: 9.5 },
    ] },
    { id: 'breast', label: 'Breaststroke', levels: [
      { label: 'Easy', sub: 'recreational', met: 5.3 },
      { label: 'Hard', sub: 'training pace', met: 10.3 },
    ] },
    { id: 'fly', label: 'Butterfly', levels: [
      { label: 'General', sub: 'any pace', met: 13.8 },
    ] },
  ] },
  { id: 'rope', label: 'Jump rope', kind: 'level', levels: [
    { label: 'Slow', sub: 'under 100 skips/min', met: 8.3 },
    { label: 'Moderate', sub: '100–120 skips/min', met: 11.8 },
    { label: 'Fast', sub: '120–160 skips/min', met: 12.3 },
  ] },
]

export const activityById = Object.fromEntries(CARDIO_ACTIVITIES.map(a => [a.id, a]))

const stairs = activityById.stairs
export const stairLevelToSpm = (level) =>
  stairs.spm.min + ((level - stairs.level.min) * (stairs.spm.max - stairs.spm.min)) / (stairs.level.max - stairs.level.min)
export const stairSpmToLevel = (spm) =>
  stairs.level.min + ((spm - stairs.spm.min) * (stairs.level.max - stairs.level.min)) / (stairs.spm.max - stairs.spm.min)

export const strokeById = (a, id) => a.strokes.find(s => s.id === id) ?? a.strokes[0]

// Net calories per minute for one activity setting.
//   speed:  { speedKmh, gradePct, outdoors }
//   watts:  { watts }
//   row:    { watts }
//   steps:  { spm }
//   level:  { level } — index into the activity's levels
//   stroke: { stroke, level } — a stroke id, then an index into its levels
export function netKcalPerMin(activityId, params, weightKg) {
  const a = activityById[activityId]
  if (a.kind === 'row') return rowGrossKcalPerMin(params.watts, weightKg) - restingKcalPerMin(weightKg)
  let netVO2
  if (a.kind === 'speed') {
    const s = (params.speedKmh * 1000) / 60
    let g = (params.gradePct || 0) / 100
    if (activityId === 'run' && params.outdoors && params.speedKmh >= OUTDOOR_RUN_FROM_KMH) g += 0.01
    netVO2 = activityId === 'run' ? runNetVO2(s, g) : walkNetVO2(s, g)
  } else if (a.kind === 'watts') {
    netVO2 = bikeNetVO2(params.watts, weightKg)
  } else if (a.kind === 'steps') {
    netVO2 = stairNetVO2(params.spm, a.stepM)
  } else {
    const levels = a.kind === 'stroke' ? strokeById(a, params.stroke).levels : a.levels
    netVO2 = (levels[params.level ?? 0].met - 1) * ML_O2_PER_MET
  }
  return (netVO2 * weightKg * KCAL_PER_L_O2) / 1000
}

// Heart rate, for any activity: Keytel et al. 2005, the version without a
// VO2max, one equation per sex. It predicts gross kJ/min and was built on
// steady exercise, so it only takes heart rates in a working range.
export const HR_BOUNDS = { min: 90, max: 190 }

export function netKcalPerMinFromHR({ hr, weightKg, age, sex }) {
  const kj = sex === 'female'
    ? -20.4022 + 0.4472 * hr - 0.1263 * weightKg + 0.074 * age
    : -55.0969 + 0.6309 * hr + 0.1988 * weightKg + 0.2017 * age
  return kj / KJ_PER_KCAL - restingKcalPerMin(weightKg)
}

// Minutes as people read them: "45 min" under an hour, "1:25 hr" from there.
export function durationParts(minutes) {
  const m = Math.round(minutes)
  if (m < 60) return { value: String(m), unit: 'min' }
  return { value: `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`, unit: 'hr' }
}

export const formatDuration = (minutes) => {
  const d = durationParts(minutes)
  return `${d.value} ${d.unit}`
}

// Steps. Flat walking's net cost per metre doesn't depend on speed (the ACSM
// walking equation is 0.1 ml O2 per kg per metre), so a step costs that times
// the step's length. Step length from height is the standard pedometer rule of
// thumb (0.415 × height for men, 0.413 for women).
const WALK_NET_KCAL_PER_KG_PER_M = (0.1 * KCAL_PER_L_O2) / 1000

export const stepLengthM = (heightCm, sex) => (heightCm / 100) * (sex === 'female' ? 0.413 : 0.415)

export const netKcalPerStep = (weightKg, heightCm, sex) =>
  WALK_NET_KCAL_PER_KG_PER_M * weightKg * stepLengthM(heightCm, sex)

// Ready-made settings for the TDEE page's box: one easy-to-picture option per
// common machine or habit, all moderate and low-fatigue enough to stack on
// top of lifting.
export const CARDIO_PRESETS = [
  { id: 'brisk-walk', label: 'Brisk walk', activity: 'walk', params: { speedKmh: 5.5, gradePct: 0 } },
  { id: 'incline-walk', label: 'Incline walk', activity: 'walk', params: { speedKmh: 5, gradePct: 10 } },
  { id: 'easy-run', label: 'Easy run', activity: 'run', params: { speedKmh: 8, gradePct: 0 } },
  { id: 'bike', label: 'Stationary bike', activity: 'bike', params: { watts: 100 } },
]
