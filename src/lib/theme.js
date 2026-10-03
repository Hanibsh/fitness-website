import { useEffect, useState } from 'react'

// Site themes. Preference is stored on the device, and on the account when
// signed in (profiles.theme — auth.jsx brings it to each device you sign in
// on); with nothing stored we follow the OS (light or dark). The actual
// switch is just `data-theme` on
// <html>, which re-points the --color-* variables (see index.css). index.html
// sets it before first paint to avoid a flash; this module keeps it in sync
// when the theme changes from the profile's Appearance picker (the only
// control since the navbar's light/dark button was removed, 2026-10-03 — it
// fought the picker's coloured themes).
//
// `tone` is whether the page is light or dark: it picks the `dark:` variant
// (index.css lists the dark-tone themes). `bg` is the page colour, for the
// browser chrome — keep it, and the copy in index.html, in step with
// --color-cream in index.css. `swatch` is what the picker draws:
// page, card, ink. `chart` is the first three series colours, so the picker
// shows each theme's charts too.
export const THEMES = [
  { id: 'light', label: 'Light', tone: 'light', bg: '#FAF9F6', swatch: ['#FAF9F6', '#FFFFFF', '#1a1a1a'], chart: ['#2a78d6', '#eb6834', '#1baf7a'] },
  { id: 'dark', label: 'Dark', tone: 'dark', bg: '#15161a', swatch: ['#15161a', '#1e2027', '#f0efeb'], chart: ['#3987e5', '#d95926', '#199e70'] },
  { id: 'olive', label: 'Olive & cream', tone: 'light', bg: '#EFE9DA', swatch: ['#EFE9DA', '#F8F4E9', '#3A4628'], chart: ['#4c7fb9', '#c07a4f', '#226531'] },
  { id: 'burgundy', label: 'Burgundy & black', tone: 'dark', bg: '#2B1016', swatch: ['#2B1016', '#150F10', '#EFE4D4'], chart: ['#4e81bc', '#c57f52', '#33733e'] },
  { id: 'gold', label: 'Gold & black', tone: 'dark', bg: '#0F0E0C', swatch: ['#0F0E0C', '#1A1814', '#C8AB6E'], chart: ['#4e81bc', '#c57f52', '#33733e'] },
]

const KEY = 'leon_theme'
const EVENT = 'leon-themechange'

export function themeById(id) {
  return THEMES.find((t) => t.id === id) || null
}

export function storedTheme() {
  try {
    const t = localStorage.getItem(KEY)
    return themeById(t) ? t : null
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
  const t = themeById(theme) || THEMES[0]
  document.documentElement.dataset.theme = t.id
  // Keep the mobile browser chrome in step with the page. Two subtleties here,
  // both of which showed up as a stubbornly white status bar on iOS:
  //   1. *Every* theme-color tag has to go, not just the first. vite-plugin-pwa
  //      injects its own from the manifest's theme_color at the end of <head>,
  //      and a browser honours the first tag it finds — so leaving a stale one
  //      behind means the toggle appears to do nothing.
  //   2. The tag is replaced rather than edited in place, because older iOS
  //      Safari reads theme-color on insert and won't repaint for a mutated
  //      `content` attribute.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove())
  const next = document.createElement('meta')
  next.setAttribute('name', 'theme-color')
  next.setAttribute('content', t.bg)
  document.head.appendChild(next)
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // ignore — still apply for this session
  }
  applyTheme(theme)
  // Anything showing the current theme (the profile picker) follows along.
  window.dispatchEvent(new Event(EVENT))
}

// The theme in effect, kept current when either control changes it.
export function useTheme() {
  const [theme, setState] = useState(() => effectiveTheme())
  useEffect(() => {
    const sync = () => setState(effectiveTheme())
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [])
  return theme
}
