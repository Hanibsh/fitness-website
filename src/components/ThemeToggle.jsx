import { useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { effectiveTheme, setTheme } from '../lib/theme'

// Sun/moon button in the navbar that flips light/dark. The icon shows what
// you'll switch TO, which is the common convention.
export default function ThemeToggle() {
  const [theme, setThemeState] = useState(() => effectiveTheme())

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer p-1 flex items-center"
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}
