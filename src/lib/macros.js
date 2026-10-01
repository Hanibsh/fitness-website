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
