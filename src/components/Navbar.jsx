import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import AuthModal from './AuthModal'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/tools', label: 'Tools' },
  { to: '/log', label: 'Log' },
  { to: '/programs', label: 'Programs' },
  { to: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const location = useLocation()
  const { user, signOut } = useAuth()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-cream-dark/90 backdrop-blur-md border-b border-border">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="font-heading text-lg font-semibold text-text-primary tracking-tight no-underline">
          LEON
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`text-[13px] tracking-wide no-underline transition-colors ${
                location.pathname === to
                  ? 'text-text-primary font-medium'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {label}
            </Link>
          ))}

          {supabase && (
            user ? (
              <div className="flex items-center gap-3">
                <Link
                  to="/account"
                  title={user.email}
                  className={`text-[13px] max-w-[150px] truncate no-underline transition-colors ${
                    location.pathname === '/account' ? 'text-text-primary font-medium' : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {user.email}
                </Link>
                <button
                  onClick={signOut}
                  aria-label="Log out"
                  className="text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
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
          className="md:hidden text-text-primary bg-transparent border-none cursor-pointer"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-cream-dark border-b border-border overflow-hidden"
          >
            <div className="px-6 py-4 flex flex-col gap-4">
              {navLinks.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setIsOpen(false)}
                  className={`text-sm no-underline ${
                    location.pathname === to ? 'text-text-primary font-medium' : 'text-text-muted'
                  }`}
                >
                  {label}
                </Link>
              ))}

              {supabase && (
                <div className="pt-3 border-t border-border">
                  {user ? (
                    <div className="flex items-center justify-between gap-3">
                      <Link
                        to="/account"
                        onClick={() => setIsOpen(false)}
                        title={user.email}
                        className="text-[13px] text-text-muted truncate no-underline hover:text-text-primary"
                      >
                        {user.email}
                      </Link>
                      <button
                        onClick={() => { signOut(); setIsOpen(false) }}
                        className="text-[13px] text-text-primary bg-transparent border-none cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                      >
                        <LogOut className="w-4 h-4" /> Log out
                      </button>
                    </div>
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
