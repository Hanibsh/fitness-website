// Movement patterns — the resistance path a movement puts a muscle through.
//
// The exercise database says WHAT a movement trains (muscles, contributions)
// and HOW HARD (fatigue, SFR, recovery). It has never said what the movement
// IS. Two rows can list identical muscles and be completely different jobs — a
// lat pulldown and a straight-arm pulldown both read "Lats 1.0, Biceps 0.5" —
// and two rows can look unrelated and be perfect substitutes for each other: a
// Chest Supported T-Bar Row and a Chest Supported Row Machine share almost no
// words in their names but are the same job.
//
// A PATTERN is the missing axis. It is defined mechanically, by three things:
//
//   jointActions — which joints move, in which direction. This is the part that
//                  cannot be argued with: a hip thrust and a Romanian deadlift
//                  are both hip extension, a leg curl is knee flexion, a
//                  pulldown is shoulder adduction plus elbow flexion.
//   path         — where the resistance travels relative to the torso, and
//                  therefore where in the range it peaks. Hip extension against
//                  a vertical bar (hinge) and hip extension against a horizontal
//                  load at the hips (thrust) are the same joint action with
//                  opposite strength curves, so they are NOT one pattern.
//   drivers      — the muscle atoms a pattern is actually there to grow. Used as
//                  a cross-check at build time: a row whose top-weighted muscle
//                  is not a driver of the pattern it landed on is almost always
//                  a misclassification, and the lint report says so.
//
// Two movements sharing a pattern are substitutable: same joints, same
// direction, same strength curve, so the same stimulus with different hardware.
// That is the whole point — a plan should prescribe "any vertical pull, 3 x 8-12"
// and let you fill it with whatever the gym has free.
//
// The pattern says the PATH, never the target. "Any horizontal push" covers a
// wide-grip bench and a close-grip JM press; which end of that list you are
// offered is decided by the muscle the slot is there to train, not by the
// pattern. Keeping those two separate is what stops the taxonomy from
// collapsing back into a list of body parts.
//
// Imported by BOTH scripts/lint-exercises.mjs (node, at build time) and the app
// (Vite), so this file stays dependency-free ESM. Same arrangement as
// scripts/muscle-taxonomy.mjs.

// ---- The patterns ----------------------------------------------------------
//
// `phrase` is how a slot reads in the UI ("any vertical pull"). `group` is only
// for sectioning menus. `drivers` are muscle atoms (scripts/muscle-taxonomy.mjs
// vocabulary), not engine muscles.

export const PATTERNS = [
  // ---- Upper push ----------------------------------------------------------
  {
    id: 'horizontal-push',
    label: 'Horizontal Push',
    phrase: 'any horizontal push',
    group: 'Upper Push',
    jointActions: ['shoulder horizontal adduction', 'shoulder flexion', 'elbow extension'],
    path: 'Load pushed away from the chest, roughly perpendicular to the torso.',
    drivers: ['Middle Chest', 'Lower Chest', 'Triceps', 'Front Delts'],
    blurb:
      'Pressing away from a flat or declined torso. Flat and decline benches, machine presses, push-ups and dips all sit here — grip and torso angle move the emphasis between chest and triceps without changing the path.',
  },
  {
    id: 'incline-push',
    label: 'Incline Push',
    phrase: 'any incline push',
    group: 'Upper Push',
    jointActions: ['shoulder flexion', 'shoulder horizontal adduction', 'elbow extension'],
    path: 'Load pushed up and away from an inclined torso, between flat and overhead.',
    drivers: ['Upper Chest', 'Front Delts', 'Triceps'],
    blurb:
      'The angle between a bench press and an overhead press. Kept separate from both because the upper chest is only well trained in this band — a flat press and an overhead press each miss it from a different side.',
  },
  {
    id: 'vertical-push',
    label: 'Vertical Push',
    phrase: 'any vertical push',
    group: 'Upper Push',
    jointActions: ['shoulder flexion', 'shoulder abduction', 'elbow extension', 'scapular upward rotation'],
    path: 'Load pressed overhead, in line with the spine.',
    drivers: ['Front Delts', 'Side Delts', 'Triceps'],
    blurb:
      'Pressing straight overhead. The front delt is the only head that gets a full stretch-to-contraction range here, which is why an overhead press is not interchangeable with an incline press.',
  },
  {
    id: 'chest-fly',
    label: 'Chest Fly',
    phrase: 'any chest fly',
    group: 'Upper Push',
    jointActions: ['shoulder horizontal adduction'],
    path: 'Arms sweep together in an arc with the elbow angle fixed — no elbow extension.',
    drivers: ['Middle Chest', 'Upper Chest', 'Lower Chest'],
    blurb:
      'Chest work with the triceps taken out of it. Because the elbow never extends, a fly can load the chest in a stretch a press cannot reach, and it costs far less systemically.',
  },
  {
    id: 'lateral-raise',
    label: 'Lateral Raise',
    phrase: 'any lateral raise',
    group: 'Upper Push',
    jointActions: ['shoulder abduction'],
    path: 'Arm lifts out to the side, away from the midline, in or near the frontal plane.',
    drivers: ['Side Delts'],
    blurb:
      'The only pattern that trains the side delt as a prime mover. No press does — pressing recruits it, but never through its own range against its own line of pull.',
  },
  {
    id: 'front-raise',
    label: 'Front Raise',
    phrase: 'any front raise',
    group: 'Upper Push',
    jointActions: ['shoulder flexion', 'scapular upward rotation'],
    path: 'Arm lifts forward and up with the elbow fixed, ending overhead or at eye level.',
    drivers: ['Front Delts', 'Lower Traps'],
    blurb:
      'Shoulder flexion without the triceps. Mostly redundant next to real pressing volume, which is why it scores low — but the scapular-plane version (the Y-raise) is one of the few things that loads the lower traps directly.',
  },
  {
    id: 'rear-delt-fly',
    label: 'Rear Delt Fly',
    phrase: 'any rear delt fly',
    group: 'Upper Push',
    jointActions: ['shoulder horizontal abduction', 'shoulder external rotation', 'scapular retraction'],
    path: 'Arm sweeps back and out with the elbow fixed, away from the midline behind the torso.',
    drivers: ['Rear Delts', 'Mid Traps', 'Rotator Cuff'],
    blurb:
      'The mirror of a chest fly. Rows train the rear delt as a helper; this is the only path that makes it the prime mover, and face pulls belong here rather than with the rows for exactly that reason.',
  },
  {
    id: 'elbow-extension',
    label: 'Elbow Extension',
    phrase: 'any elbow extension',
    group: 'Upper Push',
    jointActions: ['elbow extension'],
    path: 'Elbow straightens against resistance, shoulder held still. Shoulder position sets which head is stretched.',
    drivers: ['Triceps'],
    blurb:
      'Isolated triceps work. Overhead versions load the long head in a stretch; pushdowns and kickbacks work the lateral and medial heads short. Both are elbow extension, so they substitute — but a long-head slot should stay overhead.',
  },

  // ---- Upper pull ----------------------------------------------------------
  {
    id: 'vertical-pull',
    label: 'Vertical Pull',
    phrase: 'any vertical pull',
    group: 'Upper Pull',
    jointActions: ['shoulder adduction', 'shoulder extension', 'elbow flexion', 'scapular depression'],
    path: 'Load travels from overhead down toward the torso, roughly in line with the spine.',
    drivers: ['Lats', 'Biceps', 'Teres Major', 'Lower Traps'],
    blurb:
      'Pulling down from above. Pulldowns, pull-ups and chin-ups are one pattern in different hardware — the grip changes which part of the lat leads, not what the movement is.',
  },
  {
    id: 'horizontal-pull',
    label: 'Horizontal Pull',
    phrase: 'any horizontal pull',
    group: 'Upper Pull',
    jointActions: ['shoulder extension', 'shoulder horizontal abduction', 'elbow flexion', 'scapular retraction'],
    path: 'Load pulled toward the torso, roughly perpendicular to the spine.',
    drivers: ['Mid Back', 'Lats', 'Rhomboids', 'Mid Traps', 'Rear Delts', 'Biceps'],
    blurb:
      'Rowing. Every row is here — barbell, dumbbell, cable, machine, chest-supported, inverted — because they are the same path with different amounts of the torso holding itself up. That difference is fatigue, not stimulus.',
  },
  {
    id: 'straight-arm-lat',
    label: 'Straight-Arm Lat',
    phrase: 'any straight-arm lat movement',
    group: 'Upper Pull',
    jointActions: ['shoulder extension', 'shoulder adduction'],
    path: 'Arm sweeps from overhead to the hip with the elbow fixed — no elbow flexion.',
    drivers: ['Lats', 'Teres Major', 'Lower Chest', 'Serratus Anterior', 'Middle Chest'],
    blurb:
      'Lat work with the biceps taken out of it. Pullovers and straight-arm pulldowns are the fly of the back: a deep loaded stretch a pulldown never reaches, and no arm fatigue to limit it.',
  },
  {
    id: 'shrug',
    label: 'Shrug & Scapular Raise',
    phrase: 'any shrug or scapular raise',
    group: 'Upper Pull',
    jointActions: ['scapular elevation', 'scapular retraction', 'scapular upward rotation'],
    path: 'The shoulder blade moves on the ribcage; the arm holds its angle throughout.',
    drivers: ['Upper Traps', 'Mid Traps', 'Lower Traps', 'Rhomboids'],
    blurb:
      'The scapula as the prime mover rather than the passenger. Shrugs load elevation, Kelso shrugs load retraction, Y-raises load upward rotation — three regions of the trap that pressing and rowing only ever hit indirectly.',
  },
  {
    id: 'upright-row',
    label: 'Upright Row',
    phrase: 'any upright row',
    group: 'Upper Pull',
    jointActions: ['shoulder abduction', 'scapular elevation', 'elbow flexion'],
    path: 'Elbows lead the load straight up the front of the torso, close to the body.',
    drivers: ['Upper Traps', 'Side Delts'],
    blurb:
      'Not a row and not a lateral raise — the elbow flexes, which no raise does, and the load travels vertically, which no row does. Kept separate because it is the one movement that loads traps and side delts together.',
  },
  {
    id: 'elbow-flexion',
    label: 'Elbow Flexion',
    phrase: 'any elbow flexion',
    group: 'Upper Pull',
    jointActions: ['elbow flexion'],
    path: 'Elbow bends against resistance. Shoulder position sets the stretch; grip sets which flexor leads.',
    drivers: ['Biceps', 'Brachialis', 'Brachioradialis'],
    blurb:
      'Isolated curling. Incline and preacher versions load the biceps stretched and shortened respectively; neutral and pronated grips shift the work to the brachialis and brachioradialis. One pattern, because the joint action never changes.',
  },
  {
    id: 'wrist-flexion',
    label: 'Wrist Flexion',
    phrase: 'any wrist flexion',
    group: 'Upper Pull',
    jointActions: ['wrist flexion', 'finger flexion'],
    path: 'Wrist curls under with the forearm supported.',
    drivers: ['Wrist Flexors', 'Deep Finger Flexors'],
    blurb: 'The underside of the forearm, and the grip endurance that comes with it.',
  },
  {
    id: 'wrist-extension',
    label: 'Wrist Extension',
    phrase: 'any wrist extension',
    group: 'Upper Pull',
    jointActions: ['wrist extension'],
    path: 'Wrist curls back with the forearm supported.',
    drivers: ['Wrist Extensors'],
    blurb: 'The top of the forearm — the side nothing else in a program trains.',
  },
  {
    id: 'forearm-rotation',
    label: 'Forearm Rotation',
    phrase: 'any forearm rotation',
    group: 'Upper Pull',
    jointActions: ['forearm pronation', 'forearm supination'],
    path: 'Forearm rotates about its own axis with the elbow fixed.',
    drivers: ['Pronators', 'Supinator'],
    blurb:
      'The only path that trains rotation as a prime mover. Nothing else in the database substitutes for it, which is why it stays its own pattern despite a very thin pool.',
  },

  // ---- Lower ---------------------------------------------------------------
  {
    id: 'squat',
    label: 'Squat',
    phrase: 'any squat',
    group: 'Lower',
    jointActions: ['knee extension', 'hip extension', 'ankle dorsiflexion'],
    path: 'Both legs press a load away through a deep knee bend, torso upright or supported.',
    drivers: ['Quadriceps', 'Glute Max', 'Adductors'],
    blurb:
      'Knee-dominant bilateral pressing. Barbell squats, hack squats, pendulum, belt squat and the leg press are one pattern — what separates them is how much torso the load asks you to hold up, which the axial-loading flag already records.',
  },
  {
    id: 'split-squat',
    label: 'Split Squat & Lunge',
    phrase: 'any split squat or lunge',
    group: 'Lower',
    jointActions: ['knee extension', 'hip extension', 'hip adduction'],
    path: 'One leg at a time through a deep knee bend, the trailing leg stabilising.',
    drivers: ['Quadriceps', 'Glute Max', 'Adductors'],
    blurb:
      'The unilateral half of knee-dominant work. Split from the squat because a single leg reaches more hip flexion under load, and because the stabilising demand caps loading in a way that changes the fatigue entirely.',
  },
  {
    id: 'hip-hinge',
    label: 'Hip Hinge',
    phrase: 'any hip hinge',
    group: 'Lower',
    jointActions: ['hip extension', 'spinal extension'],
    path: 'Torso rotates over the hips against a load hanging vertically — long lever, hardest stretched.',
    drivers: ['Hamstrings', 'Glute Max', 'Spinal Erectors'],
    blurb:
      'Deadlifts, Romanian deadlifts, good mornings, swings and back extensions. All hip extension with a long torso lever, so the posterior chain is loaded hardest at full stretch — the opposite strength curve to a hip thrust.',
  },
  {
    id: 'hip-thrust',
    label: 'Hip Thrust & Bridge',
    phrase: 'any hip thrust or bridge',
    group: 'Lower',
    jointActions: ['hip extension'],
    path: 'Load sits horizontally across the hips, torso supported — hardest at lockout.',
    drivers: ['Glute Max', 'Hamstrings'],
    blurb:
      'Hip extension loaded at the top rather than the bottom. Same joint action as a hinge, opposite strength curve, no spinal load — which is why the two complement each other instead of replacing each other.',
  },
  {
    id: 'hip-extension-open',
    label: 'Hip Extension (Open Chain)',
    phrase: 'any open-chain hip extension',
    group: 'Lower',
    jointActions: ['hip extension'],
    path: 'The leg swings back from a fixed torso, foot free — the reverse of a hinge or a thrust.',
    drivers: ['Glute Max', 'Hamstrings'],
    blurb:
      'Kickbacks and standing cable hip extension. The glute is the only thing working, with no spinal or knee cost at all, which makes this the pattern that survives almost any injury.',
  },
  {
    id: 'knee-extension',
    label: 'Knee Extension',
    phrase: 'any knee extension',
    group: 'Lower',
    jointActions: ['knee extension'],
    path: 'Knee straightens against resistance with the hip held still.',
    drivers: ['Quadriceps'],
    blurb:
      'Isolated quad work. Leg extensions, sissy squats and wall sits all keep the hip out of it — the only way to train the rectus femoris without the hip flexing at the same time.',
  },
  {
    id: 'knee-flexion',
    label: 'Knee Flexion',
    phrase: 'any knee flexion',
    group: 'Lower',
    jointActions: ['knee flexion'],
    path: 'Knee bends against resistance with the hip held still.',
    drivers: ['Hamstrings', 'Gastrocnemius'],
    blurb:
      'The half of hamstring training a hinge cannot reach. Hinges load the hamstring at the hip; only a leg curl loads it at the knee, and seated versions do it with the muscle stretched.',
  },
  {
    id: 'hip-abduction',
    label: 'Hip Abduction',
    phrase: 'any hip abduction',
    group: 'Lower',
    jointActions: ['hip abduction'],
    path: 'Leg travels away from the midline against resistance.',
    drivers: ['Abductors', 'Glute Max'],
    blurb: 'The glute medius and minimus as prime movers — nothing else in a program trains them directly.',
  },
  {
    id: 'hip-adduction',
    label: 'Hip Adduction',
    phrase: 'any hip adduction',
    group: 'Lower',
    jointActions: ['hip adduction'],
    path: 'Leg travels toward the midline against resistance.',
    drivers: ['Adductors'],
    blurb:
      'Direct adductor work. Squats and lunges load the adductors hard as hip stabilisers, but only this path takes them through their own range.',
  },
  {
    id: 'calf-straight-leg',
    label: 'Calf Raise (Straight Leg)',
    phrase: 'any straight-leg calf raise',
    group: 'Lower',
    jointActions: ['ankle plantarflexion'],
    path: 'Rise onto the toes with the knee straight, so the gastrocnemius carries the load.',
    drivers: ['Gastrocnemius', 'Soleus'],
    blurb:
      'The gastrocnemius crosses the knee, so it only contributes with the leg straight. Standing, donkey, leg-press and hack-machine raises are all this pattern.',
  },
  {
    id: 'calf-bent-leg',
    label: 'Calf Raise (Bent Leg)',
    phrase: 'any bent-leg calf raise',
    group: 'Lower',
    jointActions: ['ankle plantarflexion'],
    path: 'Rise onto the toes with the knee bent, taking the gastrocnemius out of it.',
    drivers: ['Soleus', 'Gastrocnemius'],
    blurb:
      'Bending the knee slackens the gastrocnemius and hands the work to the soleus. That makes a seated calf raise a genuinely different exercise from a standing one, not a comfier version of it — which is why the two are never offered as substitutes for each other.',
  },
  {
    id: 'dorsiflexion',
    label: 'Dorsiflexion',
    phrase: 'any toe raise',
    group: 'Lower',
    jointActions: ['ankle dorsiflexion'],
    path: 'Toes pull up toward the shin against resistance.',
    drivers: ['Tibialis Anterior'],
    blurb: 'The front of the shin — the antagonist to every calf raise, and the only thing that trains it.',
  },

  // ---- Core ----------------------------------------------------------------
  {
    id: 'spinal-flexion',
    label: 'Spinal Flexion',
    phrase: 'any spinal flexion',
    group: 'Core',
    jointActions: ['spinal flexion'],
    path: 'Ribcage draws toward the pelvis against resistance.',
    drivers: ['Rectus Abdominis', 'Obliques'],
    blurb: 'Crunching. The abs shortening under load, which is the only way they grow rather than just brace.',
  },
  {
    id: 'anti-extension',
    label: 'Anti-Extension',
    phrase: 'any anti-extension hold',
    group: 'Core',
    jointActions: ['spinal stabilisation'],
    path: 'The spine resists being pulled into extension; nothing moves.',
    drivers: ['Rectus Abdominis', 'Transverse Abdominis', 'Obliques'],
    blurb:
      'Planks, dragon flags, ab wheels. Isometric bracing rather than shortening — trains the abs at long muscle lengths, which is not what a crunch does.',
  },
  {
    id: 'rotation',
    label: 'Rotation & Side Bend',
    phrase: 'any rotation or side bend',
    group: 'Core',
    jointActions: ['spinal rotation', 'spinal lateral flexion'],
    path: 'Torso twists or bends sideways against resistance.',
    drivers: ['Obliques', 'Rectus Abdominis'],
    blurb: 'The obliques through their own line of pull, which straight-on crunching never reaches.',
  },
  {
    id: 'hip-flexion',
    label: 'Hip Flexion',
    phrase: 'any hip flexion',
    group: 'Core',
    jointActions: ['hip flexion', 'posterior pelvic tilt'],
    path: 'Legs travel toward the torso against resistance, from a hanging or lying position.',
    drivers: ['Hip Flexors', 'Rectus Abdominis'],
    blurb:
      'Leg and knee raises. The lower abs only contribute past the point the pelvis tilts, so the range matters far more here than the load does.',
  },
]

export const PATTERN_BY_ID = new Map(PATTERNS.map((p) => [p.id, p]))
export const PATTERN_IDS = PATTERNS.map((p) => p.id)

// Menu section order. Not derived from PATTERNS, so reordering the definitions
// above cannot silently reshuffle every picker in the app.
export const PATTERN_GROUPS = ['Upper Push', 'Upper Pull', 'Lower', 'Core']

export function getPattern(id) {
  return PATTERN_BY_ID.get(id) || null
}

// How a slot reads when no movement is committed to it yet.
export function patternPhrase(id) {
  const p = PATTERN_BY_ID.get(id)
  if (!p) return 'Any movement'
  return p.phrase.charAt(0).toUpperCase() + p.phrase.slice(1)
}

// ---- Classification --------------------------------------------------------
//
// Every row in the database gets a pattern derived from what it already says.
// Three tiers, tried in order, and the tier is reported so a weak call can be
// reviewed rather than trusted:
//
//   'rule'     — a name rule matched. The database names variants "Base -
//                Variant", so the base name is strongly diagnostic and this
//                covers the large majority of rows.
//   'inferred' — no name rule matched, so the row was placed by its muscle
//                profile and type. Listed in the lint report for review.
//   null       — neither. A BLOCKER, exactly like an unknown muscle term.
//
// ORDER IS THE WHOLE DESIGN HERE. Rules are tried top to bottom and the first
// match wins, so the specific must precede the general: "Barbell Reverse Wrist
// Curl" has to meet the reverse-wrist rule before the wrist rule and long
// before the generic curl rule, and "Hack Squat Calf Raise" has to meet the
// calf rule before anything looks for the word "squat". Every rule below
// carries a `why` string that ends up in the report, so a surprising call can
// be traced back to the line that made it.

const RULES = [
  // --- forearm, before anything that looks for "curl" ---
  { p: 'forearm-rotation', why: 'pronation/supination', re: /\b(pronation|supination)\b/ },
  { p: 'wrist-extension', why: 'reverse wrist curl', re: /reverse\s+wrist\s+curl/ },
  { p: 'wrist-flexion', why: 'wrist curl', re: /wrist\s+curl/ },
  // "Forearm Cable Curls" is a wrist curl under another name (the database has
  // it on Wrist Flexors). Its REVERSE sibling is not — that one loads the
  // brachioradialis, so it is genuine elbow flexion and must fall through.
  { p: 'wrist-flexion', why: 'forearm curl (wrist flexors)', re: /forearm.*curls?/, not: /reverse/ },

  // --- scapular and delt raises, before rows and before "curl" ---
  { p: 'upright-row', why: 'upright row', re: /upright\s+row/ },
  { p: 'shrug', why: 'shrug', re: /\bshrug\b/ },
  { p: 'shrug', why: 'Y-raise (scapular upward rotation)', re: /\by[- ]?raise/ },
  { p: 'rear-delt-fly', why: 'face pull', re: /face\s+pull/ },
  {
    p: 'rear-delt-fly',
    why: 'rear delt / reverse fly / T-raise',
    re: /(rear\s+delt|reverse\s+fly|rear\s+lateral|\bt[- ]?raise)/,
  },
  { p: 'lateral-raise', why: 'lateral raise', re: /(lateral\s+raise|side\s+lateral)/ },
  { p: 'front-raise', why: 'front raise', re: /front\s+raise/ },

  // --- back ---
  { p: 'straight-arm-lat', why: 'pullover / straight-arm', re: /(pullover|straight[- ]arm)/ },
  { p: 'vertical-pull', why: 'pulldown / pull-up / chin-up', re: /(pulldown|pull[- ]?up|chin[- ]?up|muscle[- ]?up)/ },
  { p: 'horizontal-pull', why: 'row', re: /\brows?\b/ },

  // --- hips, before anything that looks for "squat" or "extension" ---
  { p: 'hip-hinge', why: 'deadlift / good morning / swing / back extension', re: /(deadlift|good\s+morning|kettlebell\s+swing|back\s+extension)/ },
  { p: 'hip-thrust', why: 'hip thrust / glute bridge', re: /(hip\s+thrusts?|glute\s+bridge)/ },
  { p: 'hip-extension-open', why: 'glute kickback / standing hip extension', re: /(kick\s?backs?|hip\s+extension)/, cat: 'Legs' },
  { p: 'hip-abduction', why: 'abduction', re: /abduction/ },
  { p: 'hip-adduction', why: 'adduction', re: /adduction/ },

  // --- lower leg, before "squat" (hack squat calf raise) and before "leg raise" ---
  { p: 'dorsiflexion', why: 'toe raise / tibialis', re: /(toe\s+raise|tibialis)/ },
  { p: 'calf-bent-leg', why: 'seated calf raise', re: /seated.*calf\s+raise/ },
  { p: 'calf-straight-leg', why: 'calf raise', re: /(calf\s+raise|donkey)/ },

  // --- knee ---
  { p: 'knee-flexion', why: 'leg curl', re: /leg\s+curl/ },
  { p: 'knee-extension', why: 'leg extension / sissy / wall squat', re: /(leg\s+extension|sissy\s+squat|wall\s+squat)/ },
  {
    p: 'split-squat',
    why: 'unilateral knee-dominant',
    re: /(bulgarian|split\s+squat|\blunges?\b|step[- ]?up|(squat.*(single|one)[- ]leg)|((single|one)[- ]leg.*squat))/,
  },
  { p: 'squat', why: 'bilateral knee-dominant press', re: /(\bsquats?\b|leg\s+press|\bhack\b|pendulum)/ },

  // --- arms ---
  {
    p: 'elbow-extension',
    why: 'triceps isolation',
    re: /(skull\s+crusher|push[- ]?down|tricep\w*\s+extension|extension.*tricep|kick\s?backs?)/,
  },
  { p: 'elbow-flexion', why: 'curl', re: /\bcurls?\b/ },

  // --- chest and shoulder pressing ---
  { p: 'chest-fly', why: 'fly / crossover / pec deck', re: /(\bfly\b|\bflyes?\b|crossover|pec\s+deck)/ },
  { p: 'vertical-push', why: 'overhead press / pike', re: /(overhead\s+press|shoulder\s+press|\bpike\b)/ },
  // "Incline press" raises the torso and biases the UPPER chest; "incline
  // push-up" raises the HANDS and biases the lower chest, which is the exact
  // opposite. Only presses belong here — push-ups fall through to the flat
  // press rule below, which is where the database's muscle data puts them.
  { p: 'incline-push', why: 'incline / landmine press', re: /(incline.*press|landmine\s+press)/ },
  {
    p: 'horizontal-push',
    why: 'flat or declined press',
    re: /(bench\s+press|chest\s+press|push[- ]?up|\bdips?\b|floor\s+press|jm\s+press|triceps\s+press)/,
  },

  // --- core ---
  { p: 'spinal-flexion', why: 'crunch / sit-up', re: /(crunch|sit[- ]?up)/ },
  { p: 'anti-extension', why: 'brace / hold', re: /(plank|dragon\s+flag|ab\s+wheel|hollow)/ },
  { p: 'rotation', why: 'twist / oblique / side bend', re: /(twist|oblique|side\s+bend|woodchop)/ },
  { p: 'hip-flexion', why: 'leg or knee raise', re: /(leg\s+raise|knee\s+raise|toes\s+to\s+bar)/ },
]

// Tier 2. Only reached when no name rule matched, so this is deliberately blunt:
// it asks what the row's heaviest muscle is and what shape the row is, and picks
// the pattern that combination almost always means. Anything it places is
// flagged 'inferred' and listed in the report — it is a safety net, not an
// authority.
const BY_TOP_ATOM = {
  'Upper Chest': (r) => (r.type === 'isolation' ? 'chest-fly' : 'incline-push'),
  'Middle Chest': (r) => (r.type === 'isolation' ? 'chest-fly' : 'horizontal-push'),
  'Lower Chest': (r) => (r.type === 'isolation' ? 'chest-fly' : 'horizontal-push'),
  'Front Delts': () => 'vertical-push',
  'Side Delts': () => 'lateral-raise',
  'Rear Delts': () => 'rear-delt-fly',
  'Rotator Cuff': () => 'rear-delt-fly',
  Lats: (r) => (r.type === 'isolation' ? 'straight-arm-lat' : 'vertical-pull'),
  'Teres Major': () => 'vertical-pull',
  'Mid Back': () => 'horizontal-pull',
  Rhomboids: () => 'horizontal-pull',
  'Upper Traps': () => 'shrug',
  'Mid Traps': () => 'shrug',
  'Lower Traps': () => 'shrug',
  'Spinal Erectors': () => 'hip-hinge',
  Biceps: () => 'elbow-flexion',
  Brachialis: () => 'elbow-flexion',
  Brachioradialis: () => 'elbow-flexion',
  Triceps: () => 'elbow-extension',
  'Wrist Flexors': () => 'wrist-flexion',
  'Deep Finger Flexors': () => 'wrist-flexion',
  'Wrist Extensors': () => 'wrist-extension',
  Pronators: () => 'forearm-rotation',
  Supinator: () => 'forearm-rotation',
  'Rectus Abdominis': () => 'spinal-flexion',
  Obliques: () => 'rotation',
  'Transverse Abdominis': () => 'anti-extension',
  'Hip Flexors': () => 'hip-flexion',
  Quadriceps: (r) => (r.type === 'isolation' ? 'knee-extension' : r.laterality === 'unilateral' ? 'split-squat' : 'squat'),
  Hamstrings: (r) => (r.type === 'isolation' ? 'knee-flexion' : 'hip-hinge'),
  'Glute Max': (r) => (r.type === 'isolation' ? 'hip-extension-open' : 'hip-thrust'),
  Adductors: () => 'hip-adduction',
  Abductors: () => 'hip-abduction',
  Gastrocnemius: () => 'calf-straight-leg',
  Soleus: () => 'calf-bent-leg',
  'Tibialis Anterior': () => 'dorsiflexion',
  'Serratus Anterior': () => 'straight-arm-lat',
}

// The heaviest-weighted muscle atom on a row, ties broken alphabetically so the
// result never depends on key order in the JSON.
export function topAtom(muscles) {
  const entries = Object.entries(muscles || {})
  if (!entries.length) return null
  const max = Math.max(...entries.map(([, w]) => w))
  return entries
    .filter(([, w]) => w === max)
    .map(([m]) => m)
    .sort()[0]
}

// `row` is a normalized record: { name, category, subCategory, type, laterality, muscles }.
// Returns { pattern, confidence, why } — pattern is null when nothing matched.
export function classifyPattern(row) {
  const name = String(row?.name || '').toLowerCase()

  for (const rule of RULES) {
    if (rule.cat && row.category !== rule.cat) continue
    if (rule.not && rule.not.test(name)) continue
    if (rule.re.test(name)) return { pattern: rule.p, confidence: 'rule', why: rule.why }
  }

  const atom = topAtom(row?.muscles)
  const fn = atom ? BY_TOP_ATOM[atom] : null
  if (fn) return { pattern: fn(row), confidence: 'inferred', why: `no name rule; heaviest muscle is ${atom}` }

  return { pattern: null, confidence: null, why: atom ? `no rule, and no fallback for ${atom}` : 'no muscles listed' }
}

// Does the pattern a row landed on actually claim the muscle the row trains
// hardest? A row that fails this is nearly always misclassified — it is how a
// leg-press calf raise filed under "squat" gets caught. Returns null when fine,
// or the offending atom when not.
export function driverMismatch(patternId, muscles) {
  const p = PATTERN_BY_ID.get(patternId)
  if (!p) return null
  const atom = topAtom(muscles)
  return atom && !p.drivers.includes(atom) ? atom : null
}
