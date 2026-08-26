// A card's title row: optional icon, the heading, and an optional control
// pushed to the right (a range switcher, a link, a button).
//
// `right` wraps, so a long action doesn't crush the heading on a narrow screen.
// Twin of Card.jsx — both were duplicated across three pages before this.
export default function SectionHeading({ children, icon: Icon, right }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-text-primary" />}
        <h2 className="font-heading text-lg font-medium text-text-primary">{children}</h2>
      </div>
      {right}
    </div>
  )
}
