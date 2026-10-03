import { useRef } from 'react'
import { Search, X } from 'lucide-react'

// The one search box. Every exercise list on the site uses this, so they all
// look and behave the same: magnifier, a ✕ once there's text, and Esc clears.
//
// Two looks, matching where it sits: `pill` is the exercise bank's rounded
// white field, `box` is the app's square cream one (logger, dashboard, tools).
//
// Esc only claims the key while there's text to clear — on an empty box it
// falls through to `onKeyDown`, so a dropdown or modal around it can still
// close on Esc as before.
//
// `floating` (pill only) makes the box a bubble that sticks just under the
// navbar once you scroll past it, so a long list never takes the search away.
// Typing while it's stuck scrolls back to where the box normally sits: the
// results render from the top, and you'd otherwise land mid-list.

// Under the fixed navbar: the notch strip, the 56px bar and its 1px border,
// then an 11px gap so the bubble reads as floating, not docked.
const FLOAT_TOP = 'calc(env(safe-area-inset-top, 0px) + 68px)'

export default function SearchField({
  value,
  onChange,
  placeholder = 'Search exercises…',
  variant = 'box',
  className = '',
  floating = false,
  // Box only: the input's vertical padding. A prop rather than a class to
  // append, because two py-* utilities on one element resolve by stylesheet
  // order, not by which came last in the string.
  padY = 'py-2.5',
  inputRef,
  onKeyDown,
  ...rest
}) {
  const localRef = useRef(null)
  const ref = inputRef || localRef
  const wrapRef = useRef(null)

  // Unstick for one measurement to find the box's own spot in the page, then
  // scroll up to it if we're below. Runs before the new results render, so
  // the page is still its old (taller) height and nothing clamps the scroll.
  const change = (next) => {
    const el = wrapRef.current
    if (floating && el) {
      const stuckTop = parseFloat(getComputedStyle(el).top) || 0
      el.style.position = 'static'
      const home = el.getBoundingClientRect().top + window.scrollY - stuckTop
      el.style.position = ''
      if (window.scrollY > home) window.scrollTo({ top: home })
    }
    onChange(next)
  }

  const clear = () => {
    change('')
    ref.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && value) {
      e.preventDefault()
      e.stopPropagation()
      change('')
      return
    }
    onKeyDown?.(e)
  }

  const input = (
    <input
      ref={ref}
      type="text"
      role="searchbox"
      enterKeyHint="search"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="none"
      spellCheck={false}
      value={value}
      onChange={(e) => change(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      aria-label={rest['aria-label'] || placeholder.replace(/…$/, '')}
      className={
        variant === 'pill'
          ? `w-full bg-white border border-border rounded-full pl-10 pr-9 py-2.5 text-[14px] text-text-primary placeholder:text-text-light focus:outline-none focus:border-border-hover ${floating ? 'shadow-lg' : ''}`
          : `flex-1 min-w-0 bg-transparent ${padY} text-text-primary text-[13px] placeholder:text-text-light outline-none`
      }
      {...rest}
    />
  )

  const clearButton = value ? (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={clear}
      aria-label="Clear search"
      className={`text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-1 inline-flex ${
        variant === 'pill' ? 'absolute right-2 top-1/2 -translate-y-1/2' : 'shrink-0 -mr-1'
      }`}
    >
      <X className="w-4 h-4" />
    </button>
  ) : null

  if (variant === 'pill') {
    return (
      <div
        ref={wrapRef}
        className={`${floating ? 'sticky z-40' : 'relative'} ${className}`}
        style={floating ? { top: FLOAT_TOP } : undefined}
      >
        <Search className="w-4 h-4 text-text-light absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        {input}
        {clearButton}
      </div>
    )
  }
  return (
    <div
      className={`flex items-center gap-2 bg-cream border border-border px-3 focus-within:border-text-primary transition-colors ${className}`}
    >
      <Search className="w-4 h-4 text-text-light shrink-0" />
      {input}
      {clearButton}
    </div>
  )
}
