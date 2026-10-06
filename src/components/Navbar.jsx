import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, LogOut, Users, MessagesSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCoachAccess } from '../lib/useClientsState'
import { useMyCoach } from '../lib/useMyCoach'
import { useCoachUnread, useMyUnreadMessages } from '../lib/useChat'
import AuthModal from './AuthModal'
import VersionBadge from './VersionBadge'

// `match` is every path a link stands for, so it stays lit across its whole
// section: Programs over your splits, their days and Import — not only on its
// own address. The calendar lives on the dashboard and the log in Tools
// (2026-10-06), so those light Home and Tools. The profile leads the row: the
// page works signed out too (its logging settings), so it's always there.
const navLinks = [
  { to: '/account', label: 'Profile', match: ['/account', '/profile'], profile: true },
  { to: '/', label: 'Home', match: ['/', '/dashboard', '/calendar'], exact: true },
  { to: '/programs', label: 'Programs', match: ['/programs', '/split', '/import'] },
  { to: '/exercises', label: 'Exercises', match: ['/exercises'] },
  { to: '/tools', label: 'Tools', match: ['/tools', '/log', '/injuries'] },
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
  // Chat sits in the bar itself, at every width, so an unread message shows
  // without opening the menu: a coached client's one chat, or the coach's
  // inbox with every client's unread added up.
  const { coach } = useMyCoach()
  const showChat = !!user && (isCoach || !!coach)
  const chatTo = isCoach ? '/coach/messages' : '/messages'
  const myUnread = useMyUnreadMessages(user?.id, showChat && !isCoach, location.pathname)
  const coachUnread = useCoachUnread(user?.id, showChat && isCoach, location.pathname)
  const unreadMessages = isCoach ? Object.values(coachUnread).reduce((a, n) => a + n, 0) : myUnread
  const onChat = location.pathname === chatTo || (isCoach && /^\/coach\/[^/]+\/messages$/.test(location.pathname))
  const onCoach = location.pathname.startsWith('/coach') && !onChat

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
          {showChat && (
            <Link
              to={chatTo}
              aria-label={unreadMessages ? `Messages, ${unreadMessages} unread` : 'Messages'}
              title="Messages"
              className={`relative mr-4 lg:mr-6 inline-flex items-center no-underline transition-colors ${
                onChat ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <MessagesSquare className="w-[18px] h-[18px]" />
              {unreadMessages > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-text-primary text-cream text-[9px] font-semibold flex items-center justify-center">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </Link>
          )}

          {/* The full row from 1024px; the menu below that. gap-6 at every
              width. */}
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
