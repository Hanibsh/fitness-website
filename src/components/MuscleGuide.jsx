// The in-depth muscle guide that leads every hub — whichever of the structured
// sections (anatomy / functions / training) the entry has, then the optional
// size line.
const SECTIONS = [
  ['anatomy', 'Anatomy'],
  ['functions', 'What it does'],
  ['training', 'How to train it'],
]

export default function MuscleGuide({ info }) {
  if (!info) return null
  const sections = SECTIONS.filter(([key]) => info[key]?.length)
  return (
    <div className="bg-white border border-border rounded-xl p-5 mt-6 mb-8 space-y-4">
      {sections.map(([key, title]) => (
        <div key={key}>
          <p className="text-[11px] uppercase tracking-[2px] text-text-light mb-1.5">{title}</p>
          <ul className="list-none m-0 p-0 space-y-1.5">
            {info[key].map((line) => (
              <li key={line} className="text-text-secondary text-[13.5px] leading-relaxed flex gap-2">
                <span className="text-text-light shrink-0">–</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {info.size && (
        <p className="text-[13px] text-accent-hover pt-3 border-t border-border font-medium">
          {info.size}
        </p>
      )}
    </div>
  )
}
