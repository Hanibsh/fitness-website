import { Component } from 'react'
import { RotateCw } from 'lucide-react'

// Last resort for a render-time throw. Without one of these React unmounts the
// whole tree, which leaves an empty #root — and since body is painted with
// --color-cream, in dark mode that's a black screen with nothing on it and no
// way back. That is exactly what a missing import in the logger looked like
// from a phone mid-session: tap a set field, everything vanishes.
//
// Nothing here reaches for the draft: it's already in localStorage, saved on
// every change, so the reload below picks the session back up where it stopped.
// Rendering the error text matters — a crash that only ever happens on a device
// you can't attach a console to is otherwise invisible.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Keep the component stack out of the UI but in the console, for when the
    // phone IS attached to a laptop.
    console.error('Unhandled render error:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-border shadow-xl p-6">
          <h1 className="font-heading text-xl font-medium text-text-primary mb-2">Something broke</h1>
          <p className="text-[13px] text-text-secondary mb-4">
            The page hit an error and stopped. Your workout is saved — reloading will pick it back up
            where it was.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full inline-flex items-center justify-center gap-2 bg-text-primary text-cream font-medium py-3 border-none cursor-pointer text-[14px] hover:bg-accent-hover transition-colors"
          >
            <RotateCw className="w-4 h-4" /> Reload
          </button>
          <p className="text-[11px] text-text-light mt-4 break-words font-mono">
            {String(this.state.error?.message || this.state.error)}
          </p>
        </div>
      </div>
    )
  }
}
