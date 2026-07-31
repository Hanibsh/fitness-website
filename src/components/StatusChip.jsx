// Small state badge — recovery status, whether a calendar day got done, etc.
// Tones are tuned per theme: these are raw palette colors, which don't flip with
// the semantic tokens, hence the explicit dark: variants.
const CHIP_TONES = {
  green: 'text-green-700 bg-green-50 border-green-300 dark:text-green-400 dark:bg-green-500/10 dark:border-green-500/30',
  amber: 'text-amber-700 bg-amber-50 border-amber-300 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/30',
  red: 'text-red-600 bg-red-50 border-red-300 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/30',
  // Neutral: the house inverted badge (Today / Up next on the split page).
  dark: 'text-cream bg-text-primary border-text-primary',
  muted: 'text-text-muted bg-cream border-border',
}

export default function StatusChip({ tone, children }) {
  return <span className={`shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 border ${CHIP_TONES[tone]}`}>{children}</span>
}
