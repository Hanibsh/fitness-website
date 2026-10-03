import { ChevronDown } from 'lucide-react'

// One section of the profile page, folded to its title until tapped. The
// page starts with every section closed, so it reads as a short list instead
// of one long form; several can be open at once, so you can fill in two and
// save once. Saving with a bad value opens the section that holds it.
export default function ProfileSection({ id, title, open, onToggle, children }) {
  const bodyId = `${id}-body`
  return (
    <section id={id} className="bg-white border border-border" style={{ scrollMarginTop: 'calc(5rem + env(safe-area-inset-top, 0px))' }}>
      <h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="w-full flex items-center justify-between gap-3 px-5 sm:px-6 py-4 bg-transparent border-none cursor-pointer text-left"
        >
          <span className="font-heading text-lg font-medium text-text-primary">{title}</span>
          <ChevronDown className={`w-4 h-4 text-text-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </h2>
      {open && (
        <div id={bodyId} className="border-t border-border px-5 sm:px-6 py-6 sm:py-7">
          {children}
        </div>
      )}
    </section>
  )
}
