// Cardio energy cost, shared by the Cardio calculator and the TDEE page's
// "burn more" box so both always quote the same minutes.
//
// Everything here is NET — calories above what you'd burn sitting still. Your
// resting burn is already in your TDEE, so counting gross calories would
// double-count it and flatter cardio by 15-30%.
//
// Walking, running and cycling use the ACSM metabolic equations, which take
// speed, incline and watts directly. Everything else uses a MET value from the
// 2024 Adult Compendium of Physical Activities (Herrmann et al.); a MET there is
// gross, so one MET (rest) comes off.

const ML_O2_PER_MET = 3.5
const KCAL_PER_L_O2 = 5
const KGM_PER_WATT = 6.12 // kg·m/min per watt, for the cycling equation

export const kmhToMs = (kmh) => kmh / 3.6
export const kmhToMph = (kmh) => kmh / 1.609344
export const mphToKmh = (mph) => mph * 1.609344

// Net VO2 (ml/kg/min) above rest. Speed in m/min, grade as a fraction.
const walkNetVO2 = (s, g) => 0.1 * s + 1.8 * s * g
const runNetVO2 = (s, g) => 0.2 * s + 0.9 * s * g
// The leg-cycling equation's extra 3.5 is the cost of pedalling with no load,
// which is real work above rest, so it stays.
const bikeNetVO2 = (watts, kg) => (1.8 * watts * KGM_PER_WATT) / kg + ML_O2_PER_MET

// `kind` picks the inputs an activity takes: speed + incline, watts, or one of
// the Compendium levels. Speed limits keep each ACSM equation inside the range
// it was built for (walking 50-100 m/min, running above ~130 m/min, with some
// overlap for brisk walkers and slow joggers).
export const CARDIO_ACTIVITIES = [
  { id: 'walk', label: 'Walking', kind: 'speed', speedKmh: { min: 2.5, max: 7, default: 5.5 }, grade: { max: 15, default: 0 } },
  { id: 'run', label: 'Running', kind: 'speed', speedKmh: { min: 6, max: 20, default: 9 }, grade: { max: 10, default: 0 } },
  { id: 'bike', label: 'Stationary bike', kind: 'watts', watts: { min: 25, max: 400, default: 100 } },
  { id: 'row', label: 'Rowing machine', kind: 'level', levels: [
    { label: 'Moderate', sub: 'under 100 W', met: 5.0 },
    { label: 'Vigorous', sub: '100–149 W', met: 7.5 },
    { label: 'Hard', sub: '150–199 W', met: 11.0 },
  ] },
  { id: 'elliptical', label: 'Elliptical', kind: 'level', levels: [
    { label: 'Moderate', sub: 'steady effort', met: 5.0 },
  ] },
  { id: 'stairs', label: 'Stair climber', kind: 'level', levels: [
    { label: 'General', sub: 'steady climb', met: 9.3 },
  ] },
  { id: 'swim', label: 'Swimming laps', kind: 'level', levels: [
    { label: 'Slow', sub: 'recreational freestyle', met: 5.8 },
    { label: 'Fast', sub: 'vigorous freestyle', met: 9.8 },
  ] },
  { id: 'rope', label: 'Jump rope', kind: 'level', levels: [
    { label: 'Slow', sub: 'under 100 skips/min', met: 8.3 },
    { label: 'Moderate', sub: '100–120 skips/min', met: 11.8 },
    { label: 'Fast', sub: '120–160 skips/min', met: 12.3 },
  ] },
]

export const activityById = Object.fromEntries(CARDIO_ACTIVITIES.map(a => [a.id, a]))

// Net calories per minute for one activity setting.
//   speed:  { speedKmh, gradePct }
//   watts:  { watts }
//   level:  { level } — index into the activity's levels
export function netKcalPerMin(activityId, params, weightKg) {
  const a = activityById[activityId]
  let netVO2
  if (a.kind === 'speed') {
    const s = (params.speedKmh * 1000) / 60
    const g = (params.gradePct || 0) / 100
    netVO2 = activityId === 'run' ? runNetVO2(s, g) : walkNetVO2(s, g)
  } else if (a.kind === 'watts') {
    netVO2 = bikeNetVO2(params.watts, weightKg)
  } else {
    netVO2 = (a.levels[params.level ?? 0].met - 1) * ML_O2_PER_MET
  }
  return (netVO2 * weightKg * KCAL_PER_L_O2) / 1000
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
