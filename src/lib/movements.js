// The movement library that powers the workout-log exercise picker.
// These are names only — no standards data — so the list can be broad and
// safe. Anything not here can still be typed in as a custom exercise.
// Ordered so the most common compound lifts surface first as suggestions.

export const MOVEMENTS = [
  // Big compounds first (default suggestions)
  { name: 'Bench Press', category: 'Chest' },
  { name: 'Squat', category: 'Legs' },
  { name: 'Deadlift', category: 'Back' },
  { name: 'Overhead Press', category: 'Shoulders' },
  { name: 'Barbell Row', category: 'Back' },
  { name: 'Pull-up', category: 'Back' },
  { name: 'Chin-up', category: 'Back' },
  { name: 'Dip', category: 'Chest' },

  // Chest
  { name: 'Incline Bench Press', category: 'Chest' },
  { name: 'Decline Bench Press', category: 'Chest' },
  { name: 'Dumbbell Bench Press', category: 'Chest' },
  { name: 'Incline Dumbbell Press', category: 'Chest' },
  { name: 'Machine Chest Press', category: 'Chest' },
  { name: 'Cable Fly', category: 'Chest' },
  { name: 'Pec Deck', category: 'Chest' },
  { name: 'Dumbbell Fly', category: 'Chest' },
  { name: 'Push-up', category: 'Chest' },

  // Back
  { name: 'Lat Pulldown', category: 'Back' },
  { name: 'Seated Cable Row', category: 'Back' },
  { name: 'Dumbbell Row', category: 'Back' },
  { name: 'T-Bar Row', category: 'Back' },
  { name: 'Pendlay Row', category: 'Back' },
  { name: 'Chest-Supported Row', category: 'Back' },
  { name: 'Machine Row', category: 'Back' },
  { name: 'Straight-Arm Pulldown', category: 'Back' },
  { name: 'Rack Pull', category: 'Back' },
  { name: 'Face Pull', category: 'Back' },
  { name: 'Shrug', category: 'Back' },

  // Legs
  { name: 'Front Squat', category: 'Legs' },
  { name: 'Hack Squat', category: 'Legs' },
  { name: 'Smith Machine Squat', category: 'Legs' },
  { name: 'Leg Press', category: 'Legs' },
  { name: 'Romanian Deadlift', category: 'Legs' },
  { name: 'Stiff-Leg Deadlift', category: 'Legs' },
  { name: 'Sumo Deadlift', category: 'Legs' },
  { name: 'Bulgarian Split Squat', category: 'Legs' },
  { name: 'Lunge', category: 'Legs' },
  { name: 'Walking Lunge', category: 'Legs' },
  { name: 'Goblet Squat', category: 'Legs' },
  { name: 'Leg Extension', category: 'Legs' },
  { name: 'Leg Curl', category: 'Legs' },
  { name: 'Seated Leg Curl', category: 'Legs' },
  { name: 'Hip Thrust', category: 'Legs' },
  { name: 'Glute Bridge', category: 'Legs' },
  { name: 'Hip Adduction', category: 'Legs' },
  { name: 'Hip Abduction', category: 'Legs' },
  { name: 'Calf Raise', category: 'Legs' },
  { name: 'Seated Calf Raise', category: 'Legs' },

  // Shoulders
  { name: 'Seated Dumbbell Press', category: 'Shoulders' },
  { name: 'Arnold Press', category: 'Shoulders' },
  { name: 'Machine Shoulder Press', category: 'Shoulders' },
  { name: 'Lateral Raise', category: 'Shoulders' },
  { name: 'Cable Lateral Raise', category: 'Shoulders' },
  { name: 'Rear Delt Fly', category: 'Shoulders' },
  { name: 'Front Raise', category: 'Shoulders' },
  { name: 'Upright Row', category: 'Shoulders' },

  // Arms
  { name: 'Barbell Curl', category: 'Arms' },
  { name: 'Dumbbell Curl', category: 'Arms' },
  { name: 'Hammer Curl', category: 'Arms' },
  { name: 'Preacher Curl', category: 'Arms' },
  { name: 'Incline Dumbbell Curl', category: 'Arms' },
  { name: 'Cable Curl', category: 'Arms' },
  { name: 'Concentration Curl', category: 'Arms' },
  { name: 'Tricep Pushdown', category: 'Arms' },
  { name: 'Overhead Tricep Extension', category: 'Arms' },
  { name: 'Skull Crusher', category: 'Arms' },
  { name: 'Close-Grip Bench Press', category: 'Arms' },
  { name: 'Tricep Dip', category: 'Arms' },
  { name: 'Wrist Curl', category: 'Arms' },

  // Core
  { name: 'Plank', category: 'Core' },
  { name: 'Hanging Leg Raise', category: 'Core' },
  { name: 'Cable Crunch', category: 'Core' },
  { name: 'Crunch', category: 'Core' },
  { name: 'Russian Twist', category: 'Core' },
  { name: 'Ab Wheel Rollout', category: 'Core' },
  { name: 'Back Extension', category: 'Core' },

  // Olympic / other
  { name: 'Power Clean', category: 'Olympic' },
  { name: 'Clean and Jerk', category: 'Olympic' },
  { name: 'Snatch', category: 'Olympic' },
  { name: 'Push Press', category: 'Olympic' },
]
