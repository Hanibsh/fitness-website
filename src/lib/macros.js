// Protein and macro math shared by the Protein and TDEE calculators, so both
// pages hand the same person the same protein number.

const AGE_PROTEIN_BUMP = 1.15
const VEGAN_PROTEIN_BUMP = 1.15

// Daily protein range, dosed from lean body mass (fat tissue needs little
// protein upkeep). Training hours widen and lift the range (Morton 2018), and
// leaner bodies get up to +16% below 20% body fat (Helms).
//
// `optimalFraction` is where in [min, max] the training-only target sits — the
// macro split nudges it per goal instead of inventing a second protein formula.
export function proteinRange({ lbmKg, bodyFat, trainingHours = 0, age = 0, vegan = false }) {
  const t = Math.min(trainingHours, 12) / 12
  const baseMinPerKg = 1.6 + 0.5 * t
  const baseMaxPerKg = 2.1 + 0.8 * t
  const leanBonus = Math.max(0, 20 - bodyFat) * 0.01
  const ageBumped = age >= 60
  const multiplier = (1 + leanBonus) * (ageBumped ? AGE_PROTEIN_BUMP : 1) * (vegan ? VEGAN_PROTEIN_BUMP : 1)

  const min = lbmKg * baseMinPerKg * multiplier
  const max = lbmKg * baseMaxPerKg * multiplier
  const optimalFraction = 0.45 + 0.4 * t
  return {
    min,
    max,
    optimal: min + (max - min) * optimalFraction,
    optimalFraction,
    ageBumped,
    leanBonusPercent: Math.round(leanBonus * 100),
  }
}

// How each goal leans the split. A deficit pushes protein toward the top of the
// range (lean mass is what's at risk); a surplus relaxes protein toward the
// middle, since extra calories do more as carbs fuelling training.
//
// Fat targets the middle of its band, except on a cut: there it aims for
// `fatPerKg` of bodyweight, held inside the band. The 35% ceiling is what keeps
// that from crowding out carbs for heavier people, whose bodyweight is partly fat.
export const MACRO_POSTURES = {
  cut: { proteinShift: 0.3, fatPct: [0.2, 0.35], fatPerKg: 0.8 },
  recomp: { proteinShift: 0, fatPct: [0.2, 0.3] },
  bulk: { proteinShift: -0.15, fatPct: [0.25, 0.3] },
}

// Essential-fat floor, per kg of bodyweight — hormones and fat-soluble vitamins.
// Women get a higher floor as a safety margin: menstrual disruption tracks low
// total energy intake more than low fat itself (the calorie floor guards that),
// but very low-fat diets tend to be part of the picture.
export const FAT_FLOOR_PER_KG = { male: 0.5, female: 0.6 }

// The carb floor that triggers the "you're squeezed" note: the RDA, roughly what
// the brain runs on daily.
export const CARB_NOTE_BELOW_G = 130

const clamp01 = (x) => Math.min(1, Math.max(0, x))

// Protein, fat and carbs for a calorie target, each as { target, min, max } in
// grams. Protein and fat are set first; carbs take whatever calories are left,
// so their range is the mirror image of the other two (most carbs when protein
// and fat sit at their low ends).
export function macroSplit({ kcal, posture, weightKg, sex, protein }) {
  const { proteinShift, fatPct, fatPerKg } = MACRO_POSTURES[posture]

  const proteinTarget = protein.min + (protein.max - protein.min) * clamp01(protein.optimalFraction + proteinShift)

  const floor = weightKg * FAT_FLOOR_PER_KG[sex]
  const fatMin = Math.max(floor, (kcal * fatPct[0]) / 9)
  const fatMax = Math.max(fatMin, (kcal * fatPct[1]) / 9)
  const fatTarget = fatPerKg
    ? Math.min(fatMax, Math.max(fatMin, weightKg * fatPerKg))
    : (fatMin + fatMax) / 2

  const carbsFrom = (p, f) => Math.max(0, (kcal - p * 4 - f * 9) / 4)

  return {
    protein: { target: proteinTarget, min: protein.min, max: protein.max },
    fat: { target: fatTarget, min: fatMin, max: fatMax, floor },
    carbs: {
      target: carbsFrom(proteinTarget, fatTarget),
      min: carbsFrom(protein.max, fatMax),
      max: carbsFrom(protein.min, fatMin),
    },
  }
}

// ── Manual adjusting ────────────────────────────────────────────────────────
// People can nudge the suggested split. Each tap moves 5% of the day's calories
// into or out of one macro; the other unlocked macros make up the difference,
// so total calories never change.

export const MACRO_STEP_PCT = 0.05

// Healthy bounds for adjusting, in calories per macro. The suggested split
// always sits inside them, so a fresh split can never start out of bounds.
//   protein — bottom of the evidence range up to ~3.3 g/kg of lean mass, past
//             which extra protein just gets burned as fuel
//   fat     — the essential minimum up to 40% of calories
//   carbs   — at least 130 g (the RDA, roughly the brain's daily use), or the
//             suggested amount if a low calorie target already put it lower
export const PROTEIN_CEILING_PER_KG_LBM = 3.3
export const FAT_CEILING_PCT = 0.4

export function macroLimits(split, { kcal, lbmKg }) {
  return {
    protein: { lo: split.protein.min * 4, hi: Math.max(split.protein.max, PROTEIN_CEILING_PER_KG_LBM * lbmKg) * 4 },
    carbs: { lo: Math.min(CARB_NOTE_BELOW_G, split.carbs.target) * 4, hi: Infinity },
    fat: { lo: split.fat.floor * 9, hi: Math.max(kcal * FAT_CEILING_PCT, split.fat.target * 9) },
  }
}

// Move `delta` calories into macro `key` (negative moves them out), paid for
// by the unlocked others: split evenly, and when one payer runs into its limit
// the rest passes to the other. The move shrinks to whatever fits; returns the
// new calories per macro, or null when nothing can move at all.
export function shiftMacro(current, limits, key, delta, locked = []) {
  if (locked.includes(key)) return null
  const payers = Object.keys(current).filter(k => k !== key && !locked.includes(k))
  if (!payers.length) return null
  // How far macro k can still move in direction `dir` before a limit.
  const room = (k, dir) => Math.max(0, dir > 0 ? limits[k].hi - current[k] : current[k] - limits[k].lo)

  const dir = Math.sign(delta)
  const payersRoom = payers.reduce((sum, k) => sum + room(k, -dir), 0)
  const size = Math.min(Math.abs(delta), room(key, dir), payersRoom)
  if (size < 1) return null

  const next = { ...current, [key]: current[key] + dir * size }
  let left = size
  const tightestFirst = [...payers].sort((a, b) => room(a, -dir) - room(b, -dir))
  tightestFirst.forEach((k, i) => {
    const take = Math.min(left / (tightestFirst.length - i), room(k, -dir))
    next[k] = current[k] - dir * take
    left -= take
  })
  return next
}
