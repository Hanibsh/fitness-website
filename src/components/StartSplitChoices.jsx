import { Sparkles, FileInput, Plus } from 'lucide-react'

// The three ways to start a split, side by side: have one built, bring one in
// (the program Leon sent you — a .txt file or its text), or lay one out
// yourself. Used where a split begins: the Programs page and an empty Training
// split list. Each card only says what it does; the host decides what tapping
// it means (reveal the generator, go to Import, open a blank split).
//
// `selected` marks the card whose option is open below (the Programs page shows
// the generator in place).
const CHOICES = [
  { key: 'build', icon: Sparkles, title: 'Build me a split', text: 'Answer a few questions and it writes the whole program around your week.' },
  { key: 'import', icon: FileInput, title: 'I have a program', text: 'Got one from Leon? Open the .txt file or paste the text.' },
  { key: 'manual', icon: Plus, title: 'I’ll make my own', text: 'Lay out your days and pick every exercise yourself, like the logger.' },
]

export default function StartSplitChoices({ onBuild, onImport, onManual, selected = null }) {
  const handlers = { build: onBuild, import: onImport, manual: onManual }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {CHOICES.map(({ key, icon: Icon, title, text }) => {
        const on = selected === key
        return (
          <button
            key={key}
            type="button"
            onClick={handlers[key]}
            aria-pressed={selected ? on : undefined}
            className={`flex sm:flex-col items-start gap-3 text-left p-4 sm:p-5 border cursor-pointer transition-colors ${
              on ? 'bg-text-primary border-text-primary' : 'bg-white border-border hover:border-border-hover'
            }`}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 sm:mt-0 ${on ? 'text-cream' : 'text-text-primary'}`} />
            <span className="min-w-0">
              <span className={`block text-[14px] font-medium ${on ? 'text-cream' : 'text-text-primary'}`}>{title}</span>
              <span className={`block text-[12px] mt-1 leading-relaxed ${on ? 'text-cream-70' : 'text-text-muted'}`}>{text}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
