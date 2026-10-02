// Getting a file or a piece of text OUT of the app: download, copy, share.
// Nothing here talks to a server — the file is built in the browser and handed
// straight to the device.

// Save a Blob under `filename`. Works on phones too: iOS Safari has honoured
// the download attribute since iOS 13, Android Chrome always has.
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoked on the next tick, not immediately — Safari reads the URL after
  // click() returns, and revoking first downloads nothing.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(filename, text) {
  downloadBlob(filename, new Blob([text], { type: 'text/plain;charset=utf-8' }))
}

// Copy to the clipboard. The async API needs a secure context; the textarea
// fallback covers an older in-app browser that doesn't have it.
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

// The phone's share sheet — straight into Notes, WhatsApp, Mail. Only offered
// where the browser has one.
export function canShareText() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

// Resolves false when the sheet was dismissed, so the caller can stay quiet
// about it rather than reporting an error nobody made.
export async function shareText({ title, text }) {
  try {
    await navigator.share({ title, text })
    return true
  } catch {
    return false
  }
}
