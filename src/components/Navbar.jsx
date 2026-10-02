import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, LogOut, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCoachAccess } from '../lib/useClientsState'
import AuthModal from './AuthModal'
import VersionBadge from './VersionBadge'
import ThemeToggle from './ThemeToggle'

// `match` is every path a link stands for, so it stays lit across its whole
// section: Log over the log and injuries (its two tabs), Programs over your
// splits, their days and Import — not only on its own address. The profile
// leads the row: the page works signed out too (its logging settings), so
// it's always there.
const navLinks = [
  { to: '/account', label: 'Profile', match: ['/account', '/profile'], profile: true },
  { to: '/', label: 'Home', match: ['/', '/dashboard'], exact: true },
  { to: '/calendar', label: 'Calendar', match: ['/calendar'] },
  { to: '/programs', label: 'Programs', match: ['/programs', '/split', '/import'] },
  { to: '/log', label: 'Log', match: ['/log', '/injuries'] },
  { to: '/exercises', label: 'Exercises', match: ['/exercises'] },
  { to: '/tools', label: 'Tools', match: ['/tools'] },
  { to: '/contact', label: 'Contact', match: ['/contact'] },
]

function isCurrent(link, pathname) {
  return link.match.some((p) => pathname === p || (!link.exact && pathname.startsWith(`${p}/`)))
}

// The profile link's label: the nickname if set, otherwise the name part of
// the email, and plain "Profile" when no one's signed in.
function accountLabel(user, nickname) {
  if (nickname && nickname.trim()) return nickname.trim()
  return user?.email ? user.email.split('@')[0] : 'Profile'
}

function linkLabel(link, user, nickname) {
  if (link.profile) return accountLabel(user, nickname)
  return link.to === '/' && user ? 'Dashboard' : link.label
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const location = useLocation()
  const { user, nickname, signOut } = useAuth()
  // The coach's own account gets its client list beside its name — the one
  // page only it can reach, and the one it opens most.
  const { isCoach } = useCoachAccess()
  const onCoach = location.pathname.startsWith('/coach')

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-surface-nav backdrop-blur-md border-b border-border">
      <div className="status-strip" aria-hidden="true" />
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="font-heading text-lg font-semibold text-text-primary tracking-tight no-underline">
            LEON
          </Link>
          <VersionBadge />
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />

          {/* The full row from 1024px; the menu below that. Eight links plus
              (for the coach) Clients don't fit a 768px bar — six only just
              did. gap-6 at every width: measured with the widest signed-in bar
              (coach, a full 150px name, "Dashboard"), it leaves 86px at 1024px
              and 44px at 1280px, where "Clients" is spelled out. */}
          <div className="hidden lg:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              title={link.profile ? user?.email : undefined}
              aria-current={isCurrent(link, location.pathname) ? 'page' : undefined}
              className={`text-[13px] tracking-wide no-underline transition-colors ${
                link.profile ? 'max-w-[150px] truncate' : ''
              } ${
                isCurrent(link, location.pathname)
                  ? 'text-text-primary font-medium'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {linkLabel(link, user, nickname)}
            </Link>
          ))}

          {/* Icon only until xl: at 1024px the row is full once you're
              signed in, and the word would push it over. */}
          {user && isCoach && (
            <Link
              to="/coach"
              aria-label="Clients"
              title="Clients"
              className={`inline-flex items-center gap-1.5 text-[13px] tracking-wide no-underline transition-colors ${
                onCoach ? 'text-text-primary font-medium' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Users className="w-4 h-4 xl:w-3.5 xl:h-3.5" />
              <span className="hidden xl:inline">Clients</span>
            </Link>
          )}

          {supabase && (
            user ? (
              <button
                onClick={signOut}
                aria-label="Log out"
                className="text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="text-[13px] font-medium text-text-primary bg-transparent border border-border px-3.5 py-1.5 cursor-pointer hover:border-border-hover transition-colors"
              >
                Log in
              </button>
            )
          )}
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isOpen}
          className="lg:hidden text-text-primary bg-transparent border-none cursor-pointer"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-cream-dark border-b border-border overflow-hidden"
          >
            <div className="px-6 py-4 flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsOpen(false)}
                  title={link.profile ? user?.email : undefined}
                  aria-current={isCurrent(link, location.pathname) ? 'page' : undefined}
                  className={`text-sm no-underline ${link.profile ? 'truncate' : ''} ${
                    isCurrent(link, location.pathname) ? 'text-text-primary font-medium' : 'text-text-muted'
                  }`}
                >
                  {linkLabel(link, user, nickname)}
                </Link>
              ))}

              {user && isCoach && (
                <Link
                  to="/coach"
                  onClick={() => setIsOpen(false)}
                  aria-current={onCoach ? 'page' : undefined}
                  className={`inline-flex items-center gap-1.5 text-sm no-underline ${onCoach ? 'text-text-primary font-medium' : 'text-text-muted'}`}
                >
                  <Users className="w-3.5 h-3.5" /> Clients
                </Link>
              )}

              {supabase && (
                <div className="pt-3 border-t border-border">
                  {user ? (
                    <button
                      onClick={() => { signOut(); setIsOpen(false) }}
                      className="text-[13px] text-text-primary bg-transparent border-none cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <LogOut className="w-4 h-4" /> Log out
                    </button>
                  ) : (
                    <button
                      onClick={() => { setAuthOpen(true); setIsOpen(false) }}
                      className="text-sm font-medium text-text-primary bg-transparent border-none cursor-pointer"
                    >
                      Log in
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </nav>
  )
}
