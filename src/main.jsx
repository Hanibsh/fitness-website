import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { AuthProvider } from './lib/auth.jsx'
import { applyTheme, effectiveTheme } from './lib/theme'

// index.html seeds the theme before first paint, but it can only see the
// theme-color tag declared above it — vite-plugin-pwa injects a second one from
// the manifest at the end of <head>, parsed later. Re-applying once here
// collapses them to a single correct tag, so a stale duplicate can never win
// and leave the mobile status bar out of step with the page.
applyTheme(effectiveTheme())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Outermost, so a throw anywhere below it — providers included — lands on
        a readable card rather than unmounting the tree and leaving a bare
        (in dark mode, black) body behind. */}
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          {/* Respect the user's OS-level reduced-motion setting for all
              framer-motion animations. */}
          <MotionConfig reducedMotion="user">
            <App />
          </MotionConfig>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)

// iOS standalone PWAs often don't re-check for a new service worker when you
// just switch back to an already-open app, so a fresh deploy can look stale.
// Nudge the check whenever the app returns to the foreground; the plugin's
// autoUpdate registration (with skipWaiting) handles activating + reloading if
// there's a new version. No-op in dev, where no SW is registered.
if ('serviceWorker' in navigator) {
  const checkForUpdates = () => {
    if (document.visibilityState !== 'visible') return
    navigator.serviceWorker.getRegistration().then((reg) => reg && reg.update()).catch(() => {})
  }
  document.addEventListener('visibilitychange', checkForUpdates)
  window.addEventListener('focus', checkForUpdates)
}
