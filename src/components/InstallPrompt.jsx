import { useState, useEffect } from 'react'
import { X, Download, Share } from 'lucide-react'

const DISMISS_KEY = 'leon_install_dismissed'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
}

// A small, dismissible "add to home screen" helper. On Android/desktop it uses
// the browser's native install prompt; on iPhone (no prompt exists) it shows
// the manual Share → Add to Home Screen tip. Hides itself once installed.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null) // captured beforeinstallprompt event
  const [iosTip, setIosTip] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    let dismissed = false
    try { dismissed = !!localStorage.getItem(DISMISS_KEY) } catch { /* ignore */ }
    if (dismissed) return

    const onBeforeInstall = (e) => {
      e.preventDefault()
      setDeferred(e)
      setShow(true)
    }
    const onInstalled = () => setShow(false)

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    // iOS Safari never fires beforeinstallprompt — offer the manual tip instead.
    if (isIOS()) {
      setIosTip(true)
      setShow(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    setShow(false)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
  }

  async function install() {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[90] mx-auto max-w-md bg-white border border-border shadow-lg p-4 flex items-center gap-3">
      <img src="/pwa-192x192.png" alt="" className="w-10 h-10 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-text-primary">Add Leon to your home screen</p>
        {iosTip ? (
          <p className="text-[12px] text-text-muted leading-snug">
            Tap <Share className="inline w-3.5 h-3.5 align-[-2px]" /> Share, then “Add to Home Screen”.
          </p>
        ) : (
          <p className="text-[12px] text-text-muted leading-snug">Quick access, works offline — no app store needed.</p>
        )}
      </div>

      {!iosTip && (
        <button
          onClick={install}
          className="shrink-0 inline-flex items-center gap-1.5 bg-text-primary text-cream text-[12px] font-medium px-3.5 py-2 border-none cursor-pointer hover:bg-accent-hover transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Install
        </button>
      )}

      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 text-text-light hover:text-text-primary bg-transparent border-none cursor-pointer p-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
