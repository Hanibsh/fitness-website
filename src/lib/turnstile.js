// Cloudflare Turnstile — fetches a fresh, single-use verification token on
// demand (invisible until a challenge is actually needed). Used to prove a
// guest contribution comes from a real browser before it hits the edge function.

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''

export const turnstileConfigured = () => !!SITE_KEY

let scriptPromise
function loadScript() {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    if (window.turnstile) return resolve()
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Turnstile'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

export async function getTurnstileToken() {
  if (!SITE_KEY) throw new Error('Turnstile not configured')
  await loadScript()
  return new Promise((resolve, reject) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    let widgetId
    const finish = (fn, arg) => {
      try { window.turnstile.remove(widgetId) } catch { /* ignore */ }
      container.remove()
      fn(arg)
    }
    try {
      widgetId = window.turnstile.render(container, {
        sitekey: SITE_KEY,
        execution: 'execute',
        callback: (token) => finish(resolve, token),
        'error-callback': () => finish(reject, new Error('Turnstile error')),
        'timeout-callback': () => finish(reject, new Error('Turnstile timeout')),
      })
      window.turnstile.execute(widgetId)
    } catch (e) {
      finish(reject, e)
    }
  })
}
