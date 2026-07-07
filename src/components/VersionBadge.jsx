import { useState } from 'react'
import Modal from './Modal'
import { STAGE, VERSION, CHANGELOG } from '../lib/version'

// Small "Alpha" pill (shown next to the wordmark) that opens the version
// history + roadmap. Bump the data in lib/version.js to update it.
export default function VersionBadge() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Version ${VERSION} (${STAGE}) — view history`}
        className="text-[9px] uppercase tracking-wider font-medium text-text-muted border border-border px-1.5 py-0.5 leading-none cursor-pointer hover:border-border-hover hover:text-text-primary transition-colors"
      >
        {STAGE}
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)} maxWidth="max-w-md">
          <div className="p-7">
            <p className="text-[11px] uppercase tracking-wider text-text-light mb-1">Version {VERSION}</p>
            <h3 className="font-heading text-2xl font-medium text-text-primary mb-6">Version history</h3>

            <div className="space-y-6">
              {CHANGELOG.map((entry) => (
                <div key={entry.version}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[13px] font-medium text-text-primary">v{entry.version}</span>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 leading-none ${
                        entry.current ? 'bg-text-primary text-cream' : 'border border-border text-text-muted'
                      }`}
                    >
                      {entry.stage}
                    </span>
                    <span className="text-[11px] text-text-light">{entry.date}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {entry.notes.map((note, i) => (
                      <li key={i} className="text-[13px] text-text-muted leading-relaxed flex gap-2">
                        <span className="text-text-light shrink-0">·</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-7 pt-6 border-t border-border">
              <p className="text-[13px] text-text-muted leading-relaxed">
                <span className="text-text-primary font-medium">More to come.</span>{' '}
                This is an early build and it&apos;s actively growing — new tools and improvements land regularly.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
