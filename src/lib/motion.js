// The site's motion, in one place, so a popup, a fold and a card reveal all
// move at the same pace. Short on purpose: an animation that makes you wait
// for the thing you tapped is worse than none.

// A soft ease-out — fast start, gentle landing.
export const EASE = [0.22, 1, 0.36, 1]

export const DURATION = {
  fast: 0.15, // closing things, dropdowns
  base: 0.22, // opening things, folds
}

// Gap between neighbours rising in together — the "wave". The rise itself is
// CSS ([data-reveal] in index.css): 0.4s on the same EASE.
export const WAVE_STEP = 0.05

// The spring the sliding toggle highlight rides on.
export const PILL_SPRING = { type: 'spring', stiffness: 500, damping: 40 }
