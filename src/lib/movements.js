// The movement library that powers the workout-log exercise picker.
// These are names only — no standards data — so the list can be broad and
// safe. Anything not here can still be typed in as a custom exercise.
// Ordered so the most common compound lifts surface first as suggestions.
//
// `keywords` are extra search terms (abbreviations, alternate names, the
// muscles worked) so the picker finds a movement even when you don't type its
// exact name — e.g. "ohp" or "shoulder" both surface the Overhead Press.
// Search also matches the category, so typing "shoulders" lists them all.

export const MOVEMENTS = [
  // Big compounds first (default suggestions)
  { name: 'Bench Press', category: 'Chest', keywords: ['barbell', 'flat', 'chest press', 'pecs'] },
  { name: 'Squat', category: 'Legs', keywords: ['barbell', 'back squat', 'quads', 'glutes'] },
  { name: 'Deadlift', category: 'Back', keywords: ['barbell', 'conventional', 'posterior chain', 'hamstrings'] },
  { name: 'Overhead Press', category: 'Shoulders', keywords: ['ohp', 'military press', 'shoulder press', 'barbell', 'delts', 'standing press'] },
  { name: 'Barbell Row', category: 'Back', keywords: ['bent over row', 'bent-over', 'lats'] },
  { name: 'Pull-up', category: 'Back', keywords: ['pullup', 'pull up', 'bodyweight', 'lats'] },
  { name: 'Chin-up', category: 'Back', keywords: ['chinup', 'chin up', 'bodyweight', 'lats', 'biceps'] },
  { name: 'Dip', category: 'Chest', keywords: ['chest dip', 'bodyweight', 'triceps'] },

  // Chest
  { name: 'Incline Bench Press', category: 'Chest', keywords: ['barbell', 'incline press', 'upper chest'] },
  { name: 'Decline Bench Press', category: 'Chest', keywords: ['barbell', 'lower chest'] },
  { name: 'Dumbbell Bench Press', category: 'Chest', keywords: ['db', 'flat dumbbell press', 'pecs'] },
  { name: 'Incline Dumbbell Press', category: 'Chest', keywords: ['db', 'incline db press', 'upper chest'] },
  { name: 'Machine Chest Press', category: 'Chest', keywords: ['machine press', 'hammer strength', 'pecs'] },
  { name: 'Cable Fly', category: 'Chest', keywords: ['cable flye', 'chest fly', 'pecs'] },
  { name: 'Cable Crossover', category: 'Chest', keywords: ['cable', 'crossover', 'chest fly', 'pecs'] },
  { name: 'Pec Deck', category: 'Chest', keywords: ['machine fly', 'chest fly', 'butterfly', 'pecs'] },
  { name: 'Dumbbell Fly', category: 'Chest', keywords: ['db', 'dumbbell flye', 'chest fly', 'pecs'] },
  { name: 'Push-up', category: 'Chest', keywords: ['pushup', 'press up', 'bodyweight'] },
  { name: 'Smith Machine Bench Press', category: 'Chest', keywords: ['smith', 'flat press', 'pecs'] },
  { name: 'Incline Machine Press', category: 'Chest', keywords: ['machine', 'upper chest', 'hammer strength'] },
  { name: 'Dumbbell Pullover', category: 'Chest', keywords: ['db', 'pullover', 'lats', 'chest'] },
  { name: 'Floor Press', category: 'Chest', keywords: ['barbell', 'dumbbell', 'triceps', 'pecs'] },

  // Back
  { name: 'Lat Pulldown', category: 'Back', keywords: ['pulldown', 'cable', 'lats', 'wide grip', 'close grip', 'neutral grip'] },
  { name: 'Single-Arm Lat Pulldown', category: 'Back', keywords: ['one arm pulldown', 'cable', 'lats'] },
  { name: 'Seated Cable Row', category: 'Back', keywords: ['cable row', 'lats', 'mid back'] },
  { name: 'Dumbbell Row', category: 'Back', keywords: ['db', 'one arm row', 'single arm row', 'lats'] },
  { name: 'T-Bar Row', category: 'Back', keywords: ['tbar', 'landmine row', 'lats'] },
  { name: 'Pendlay Row', category: 'Back', keywords: ['barbell row', 'dead stop row', 'lats'] },
  { name: 'Meadows Row', category: 'Back', keywords: ['landmine', 'single arm', 'lats'] },
  { name: 'Chest-Supported Row', category: 'Back', keywords: ['chest supported', 'machine row', 'lats'] },
  { name: 'Machine Row', category: 'Back', keywords: ['hammer strength', 'seated row', 'lats'] },
  { name: 'Inverted Row', category: 'Back', keywords: ['bodyweight row', 'australian pull-up', 'lats'] },
  { name: 'Straight-Arm Pulldown', category: 'Back', keywords: ['cable', 'lat pushdown', 'lats'] },
  { name: 'Rack Pull', category: 'Back', keywords: ['partial deadlift', 'traps', 'posterior chain'] },
  { name: 'Face Pull', category: 'Back', keywords: ['cable', 'rear delts', 'rotator cuff'] },
  { name: 'Shrug', category: 'Back', keywords: ['barbell shrug', 'dumbbell shrug', 'traps'] },
  { name: 'Smith Machine Row', category: 'Back', keywords: ['smith', 'bent over row', 'lats'] },
  { name: 'Seal Row', category: 'Back', keywords: ['chest supported', 'barbell', 'dumbbell', 'lats'] },
  { name: 'Cable Pullover', category: 'Back', keywords: ['cable', 'straight arm', 'lats'] },
  { name: 'Assisted Pull-up', category: 'Back', keywords: ['machine', 'assisted pullup', 'lats'] },

  // Legs
  { name: 'Front Squat', category: 'Legs', keywords: ['barbell', 'quads'] },
  { name: 'Hack Squat', category: 'Legs', keywords: ['machine squat', 'quads'] },
  { name: 'Smith Machine Squat', category: 'Legs', keywords: ['smith squat', 'quads'] },
  { name: 'Leg Press', category: 'Legs', keywords: ['machine', 'quads', 'glutes'] },
  { name: 'Romanian Deadlift', category: 'Legs', keywords: ['rdl', 'hip hinge', 'hamstrings', 'glutes'] },
  { name: 'Stiff-Leg Deadlift', category: 'Legs', keywords: ['sldl', 'straight leg deadlift', 'hamstrings'] },
  { name: 'Sumo Deadlift', category: 'Legs', keywords: ['wide stance deadlift', 'glutes'] },
  { name: 'Trap Bar Deadlift', category: 'Legs', keywords: ['hex bar deadlift', 'quads', 'glutes'] },
  { name: 'Good Morning', category: 'Legs', keywords: ['barbell', 'hip hinge', 'hamstrings', 'lower back'] },
  { name: 'Bulgarian Split Squat', category: 'Legs', keywords: ['bss', 'rear foot elevated', 'quads', 'glutes'] },
  { name: 'Lunge', category: 'Legs', keywords: ['dumbbell lunge', 'quads', 'glutes'] },
  { name: 'Walking Lunge', category: 'Legs', keywords: ['quads', 'glutes'] },
  { name: 'Step-up', category: 'Legs', keywords: ['stepup', 'box step up', 'quads', 'glutes'] },
  { name: 'Goblet Squat', category: 'Legs', keywords: ['dumbbell squat', 'kettlebell', 'quads'] },
  { name: 'Leg Extension', category: 'Legs', keywords: ['machine', 'quads', 'knee extension'] },
  { name: 'Leg Curl', category: 'Legs', keywords: ['lying leg curl', 'hamstrings'] },
  { name: 'Seated Leg Curl', category: 'Legs', keywords: ['machine', 'hamstrings'] },
  { name: 'Nordic Curl', category: 'Legs', keywords: ['nordic ham curl', 'nordic hamstring', 'hamstrings'] },
  { name: 'Hip Thrust', category: 'Legs', keywords: ['barbell hip thrust', 'glutes'] },
  { name: 'Glute Bridge', category: 'Legs', keywords: ['glutes'] },
  { name: 'Hip Adduction', category: 'Legs', keywords: ['machine', 'inner thigh', 'adductors'] },
  { name: 'Hip Abduction', category: 'Legs', keywords: ['machine', 'outer thigh', 'abductors', 'glutes'] },
  { name: 'Calf Raise', category: 'Legs', keywords: ['standing calf raise', 'calves'] },
  { name: 'Seated Calf Raise', category: 'Legs', keywords: ['machine', 'calves', 'soleus'] },
  { name: 'Belt Squat', category: 'Legs', keywords: ['machine', 'quads', 'glutes'] },
  { name: 'Pendulum Squat', category: 'Legs', keywords: ['machine', 'quads'] },
  { name: 'Sissy Squat', category: 'Legs', keywords: ['quads', 'bodyweight'] },
  { name: 'Reverse Lunge', category: 'Legs', keywords: ['dumbbell', 'barbell', 'quads', 'glutes'] },
  { name: 'Cable Pull-Through', category: 'Legs', keywords: ['cable', 'hip hinge', 'glutes', 'hamstrings'] },
  { name: 'Glute Kickback', category: 'Legs', keywords: ['cable', 'machine', 'glutes'] },
  { name: 'Standing Leg Curl', category: 'Legs', keywords: ['machine', 'hamstrings'] },
  { name: 'Donkey Calf Raise', category: 'Legs', keywords: ['machine', 'calves'] },
  { name: 'Tibialis Raise', category: 'Legs', keywords: ['tib raise', 'shins', 'tibialis anterior'] },

  // Shoulders
  { name: 'Seated Dumbbell Press', category: 'Shoulders', keywords: ['db', 'dumbbell shoulder press', 'seated press', 'delts', 'ohp'] },
  { name: 'Standing Dumbbell Shoulder Press', category: 'Shoulders', keywords: ['db', 'dumbbell shoulder press', 'standing press', 'delts', 'ohp'] },
  { name: 'Arnold Press', category: 'Shoulders', keywords: ['db', 'dumbbell', 'shoulder press', 'delts'] },
  { name: 'Machine Shoulder Press', category: 'Shoulders', keywords: ['machine press', 'delts'] },
  { name: 'Landmine Press', category: 'Shoulders', keywords: ['landmine', 'shoulder press', 'delts'] },
  { name: 'Lateral Raise', category: 'Shoulders', keywords: ['db', 'dumbbell', 'side raise', 'side delts', 'delts'] },
  { name: 'Cable Lateral Raise', category: 'Shoulders', keywords: ['cable', 'side raise', 'side delts'] },
  { name: 'Rear Delt Fly', category: 'Shoulders', keywords: ['reverse fly', 'rear delts', 'db', 'dumbbell'] },
  { name: 'Reverse Pec Deck', category: 'Shoulders', keywords: ['machine reverse fly', 'rear delts'] },
  { name: 'Front Raise', category: 'Shoulders', keywords: ['db', 'dumbbell', 'front delts'] },
  { name: 'Upright Row', category: 'Shoulders', keywords: ['barbell', 'cable', 'delts', 'traps'] },
  { name: 'Smith Machine Shoulder Press', category: 'Shoulders', keywords: ['smith', 'shoulder press', 'delts', 'ohp'] },
  { name: 'Machine Lateral Raise', category: 'Shoulders', keywords: ['machine', 'side raise', 'side delts'] },
  { name: 'Cable Rear Delt Fly', category: 'Shoulders', keywords: ['cable', 'reverse fly', 'rear delts'] },

  // Arms
  { name: 'Barbell Curl', category: 'Arms', keywords: ['bicep curl', 'biceps', 'ez bar'] },
  { name: 'Dumbbell Curl', category: 'Arms', keywords: ['db', 'bicep curl', 'biceps'] },
  { name: 'Hammer Curl', category: 'Arms', keywords: ['db', 'dumbbell', 'biceps', 'brachialis', 'forearms'] },
  { name: 'Preacher Curl', category: 'Arms', keywords: ['bicep curl', 'biceps'] },
  { name: 'Incline Dumbbell Curl', category: 'Arms', keywords: ['db', 'bicep curl', 'biceps'] },
  { name: 'Cable Curl', category: 'Arms', keywords: ['bicep curl', 'biceps'] },
  { name: 'Concentration Curl', category: 'Arms', keywords: ['db', 'bicep curl', 'biceps'] },
  { name: 'Spider Curl', category: 'Arms', keywords: ['bicep curl', 'biceps'] },
  { name: 'Reverse Curl', category: 'Arms', keywords: ['barbell', 'forearms', 'brachialis'] },
  { name: 'Tricep Pushdown', category: 'Arms', keywords: ['cable', 'triceps', 'pressdown', 'rope pushdown'] },
  { name: 'Overhead Tricep Extension', category: 'Arms', keywords: ['cable', 'dumbbell', 'triceps', 'french press'] },
  { name: 'Skull Crusher', category: 'Arms', keywords: ['lying tricep extension', 'triceps', 'ez bar'] },
  { name: 'Close-Grip Bench Press', category: 'Arms', keywords: ['cgbp', 'barbell', 'triceps'] },
  { name: 'Tricep Kickback', category: 'Arms', keywords: ['db', 'dumbbell', 'cable', 'triceps'] },
  { name: 'Tricep Dip', category: 'Arms', keywords: ['bench dip', 'triceps', 'bodyweight'] },
  { name: 'Wrist Curl', category: 'Arms', keywords: ['forearms', 'barbell', 'dumbbell'] },
  { name: 'Reverse Wrist Curl', category: 'Arms', keywords: ['forearms', 'wrist extension'] },
  { name: 'Cable Hammer Curl', category: 'Arms', keywords: ['rope curl', 'biceps', 'brachialis'] },
  { name: 'Machine Curl', category: 'Arms', keywords: ['machine', 'bicep curl', 'biceps'] },

  // Core
  { name: 'Plank', category: 'Core', keywords: ['bodyweight', 'abs', 'isometric'] },
  { name: 'Side Plank', category: 'Core', keywords: ['bodyweight', 'obliques', 'abs'] },
  { name: 'Hanging Leg Raise', category: 'Core', keywords: ['abs', 'lower abs', 'bodyweight'] },
  { name: 'Cable Crunch', category: 'Core', keywords: ['cable', 'abs', 'rope crunch'] },
  { name: 'Crunch', category: 'Core', keywords: ['abs', 'bodyweight'] },
  { name: 'Sit-up', category: 'Core', keywords: ['situp', 'abs', 'bodyweight'] },
  { name: 'Russian Twist', category: 'Core', keywords: ['obliques', 'abs'] },
  { name: 'Pallof Press', category: 'Core', keywords: ['cable', 'anti-rotation', 'obliques'] },
  { name: 'Ab Wheel Rollout', category: 'Core', keywords: ['ab roller', 'abs'] },
  { name: 'Back Extension', category: 'Core', keywords: ['hyperextension', 'lower back', 'erectors'] },
  { name: 'Lying Leg Raise', category: 'Core', keywords: ['leg raise', 'lower abs', 'bodyweight'] },
  { name: 'Reverse Crunch', category: 'Core', keywords: ['lower abs', 'bodyweight'] },
  { name: 'Bicycle Crunch', category: 'Core', keywords: ['obliques', 'abs', 'bodyweight'] },
  { name: 'Machine Crunch', category: 'Core', keywords: ['machine', 'ab crunch', 'abs'] },
  { name: 'Cable Woodchop', category: 'Core', keywords: ['cable', 'woodchopper', 'obliques'] },
  { name: 'Mountain Climber', category: 'Core', keywords: ['bodyweight', 'abs', 'conditioning'] },

  // Cardio
  { name: 'Running', category: 'Cardio', keywords: ['run', 'treadmill', 'jog', 'conditioning'] },
  { name: 'Incline Walk', category: 'Cardio', keywords: ['treadmill', 'walking', 'conditioning'] },
  { name: 'Cycling', category: 'Cardio', keywords: ['bike', 'stationary bike', 'spin', 'conditioning'] },
  { name: 'Rowing', category: 'Cardio', keywords: ['rower', 'erg', 'conditioning'] },
  { name: 'Stair Climber', category: 'Cardio', keywords: ['stairmaster', 'steps', 'conditioning'] },
  { name: 'Elliptical', category: 'Cardio', keywords: ['cross trainer', 'conditioning'] },
  { name: 'Jump Rope', category: 'Cardio', keywords: ['skipping', 'conditioning'] },
  { name: 'Swimming', category: 'Cardio', keywords: ['swim', 'pool', 'conditioning'] },

  // Olympic / other
  { name: 'Power Clean', category: 'Olympic', keywords: ['barbell', 'clean', 'explosive'] },
  { name: 'Clean and Jerk', category: 'Olympic', keywords: ['barbell', 'clean', 'jerk'] },
  { name: 'Snatch', category: 'Olympic', keywords: ['barbell', 'explosive'] },
  { name: 'Push Press', category: 'Olympic', keywords: ['barbell', 'overhead', 'leg drive', 'delts'] },

  // Full body / loaded carries
  { name: 'Kettlebell Swing', category: 'Full Body', keywords: ['kettlebell', 'kb', 'hip hinge', 'glutes', 'hamstrings'] },
  { name: 'Thruster', category: 'Full Body', keywords: ['barbell', 'dumbbell', 'squat to press', 'conditioning'] },
  { name: "Farmer's Carry", category: 'Full Body', keywords: ['farmers walk', 'loaded carry', 'grip', 'traps', 'forearms'] },
]

// Whole-word abbreviations expanded before searching, so "db shoulder" finds
// the dumbbell shoulder presses, "ohp" finds the overhead press, etc.
const ABBREVIATIONS = {
  db: 'dumbbell',
  bb: 'barbell',
  ohp: 'overhead press',
  rdl: 'romanian deadlift',
  sldl: 'stiff-leg deadlift',
  bss: 'bulgarian split squat',
  cgbp: 'close-grip bench press',
}

function haystack(m) {
  return [m.name, m.category, ...(m.keywords || [])].join(' ').toLowerCase()
}

function tokenize(q) {
  return q
    .split(/\s+/)
    .map((t) => ABBREVIATIONS[t] || t)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean)
}

// The searchable set of exercises for a given user: their previously-logged
// movements first (most-recent first, so the picker surfaces what they
// actually use), then the full library — deduped by name. A recent movement
// that isn't in the library shows up as a plain custom entry so it can be
// re-logged with an identical name (keeps progress charts continuous).
export function exercisePool(recentNames = []) {
  const seen = new Set()
  const pool = []
  const push = (item) => {
    const key = item.name.trim().toLowerCase()
    if (!key || seen.has(key)) return
    seen.add(key)
    pool.push(item)
  }
  for (const name of recentNames) {
    const known = MOVEMENTS.find((m) => m.name.toLowerCase() === name.trim().toLowerCase())
    push(known || { name: name.trim(), category: 'Recent', keywords: [] })
  }
  for (const m of MOVEMENTS) push(m)
  return pool
}

// Token-based search over the pool: every word in the query must appear in the
// movement's name, category, or keywords (any order). Empty query returns the
// whole pool (recents first). Name-prefix matches float to the top ("run"
// leads with Running, not Crunch); stable sort preserves pool order otherwise.
export function searchExercises(query, recentNames = []) {
  const pool = exercisePool(recentNames)
  const q = (query || '').trim().toLowerCase()
  if (!q) return pool
  const tokens = tokenize(q)
  return pool
    .filter((m) => {
      const text = haystack(m)
      return tokens.every((t) => text.includes(t))
    })
    .sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)))
}
