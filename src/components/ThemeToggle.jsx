import { Sun, Moon } from 'lucide-react'
import { setTheme, themeById, useTheme } from '../lib/theme'

// Sun/moon button in the navbar: a quick light/dark switch. The icon shows what
// you'll switch TO, which is the common convention. On one of the coloured
// themes (picked on the profile page) it goes to plain light or dark — the
// opposite of the theme's own tone.
export default function ThemeToggle() {
  const theme = useTheme()
  const dark = themeById(theme)?.tone === 'dark'
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <button
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className="text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer p-1 flex items-center"
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}
