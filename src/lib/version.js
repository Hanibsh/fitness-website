// App version + changelog. Bump VERSION/STAGE and prepend a CHANGELOG entry
// whenever there's a release worth noting. STAGE drives the little badge shown
// in the navbar; the full history and roadmap live in the version modal.

export const VERSION = '0.1.0'
export const STAGE = 'Alpha'

// Newest first. `stage` is the release stage at that point.
export const CHANGELOG = [
  {
    version: '0.1.0',
    stage: 'Alpha',
    date: 'July 2026',
    current: true,
    notes: [
      'First public build — everything here is early and evolving.',
      'Free calculators: TDEE, one-rep max, protein, creatine, strength standards, FFMI, muscle-gain potential, and calorie deficit.',
      'Workout log with 100+ exercises, smart search, cardio tracking, and progress charts.',
      'Personal dashboard: streaks, calendar, weekly muscle volume, records, goals, and lifetime stats.',
      'Optional free account to sync your workouts across devices.',
      'Installable to your home screen and works offline.',
    ],
  },
]

// Where things are headed — shown as "What's next" in the version modal.
export const ROADMAP = [
  {
    stage: 'Beta',
    goal: 'Refined and battle-tested with real users — training programs, deeper goal tracking, and polish based on your feedback.',
  },
  {
    stage: '1.0',
    goal: 'The full release: stable, complete, and ready for everyone.',
  },
]
