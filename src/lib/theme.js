// Light/dark theme. Preference is stored on the device; with nothing stored we
// follow the OS. The actual switch is just `data-theme` on <html>, which flips
// the --color-* variables (see index.css). index.html sets it before first
// paint to avoid a flash; this module keeps it in sync when the user toggles.

const KEY = 'leon_theme'
const DARK_BG = '#15161a'
const LIGHT_BG = '#FAF9F6'

export function storedTheme() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
}

// The theme actually in effect: the stored choice, or the OS preference.
export function effectiveTheme() {
  return storedTheme() || (systemPrefersDark() ? 'dark' : 'light')
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  // Keep the mobile browser chrome in step with the page.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? DARK_BG : LIGHT_BG)
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // ignore — still apply for this session
  }
  applyTheme(theme)
}
