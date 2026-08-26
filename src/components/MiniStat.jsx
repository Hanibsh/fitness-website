// One number with a label above and an optional aside below. The unit the app
// builds its little stat rows out of — put three or four in a grid.
//
// Moved out of Dashboard when the injuries overview needed it too: importing it
// from a page would have chained two lazy-loaded chunks together to share eight
// lines of markup.
export default function MiniStat({ label, value, sub }) {
  return (
    <div className="bg-cream border border-border px-3 py-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-text-light mb-1">{label}</p>
      <p className="text-[15px] font-medium text-text-primary break-words">{value}</p>
      {sub && <p className="text-[10px] text-text-muted mt-0.5">{sub}</p>}
    </div>
  )
}
