// The site's motion, in one place. The animations themselves are CSS (the
// Motion block at the end of index.css) or a WAAPI `el.animate()` — never a
// per-frame JS loop — and move only opacity and transform, so the GPU runs
// them even while the page is busy. That's what keeps them smooth on a phone.

// A soft ease-out — fast start, gentle landing. Same curve as the CSS.
export const EASE_CSS = 'cubic-bezier(0.22, 1, 0.36, 1)'

// Gap between cards rising in together — the "wave".
export const WAVE_STEP = 0.04

// The toggle highlight sliding to the option you tapped (ActivePill.jsx).
export const PILL_MS = 200

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
