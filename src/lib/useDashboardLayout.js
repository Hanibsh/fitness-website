import { useCallback, useMemo, useState } from 'react'
import { useAuth } from './auth'
import { saveProfile } from './profile'
import { defaultLayout, getLocalLayout, normalizeLayout, saveLocalLayout } from './dashboardLayout'

// The dashboard layout, read and written in one place (lib/dashboardLayout.js
// for the shape). Signed in, the account's copy wins — it's the one that
// follows you between devices — and the device keeps a copy of every save, so
// the layout still holds before profiles.dashboard_layout exists in the DB or
// when you're signed out. Saves are instant: no Save button, like the other
// device settings.
export function useDashboardLayout() {
  const { user, profile, mergeProfile } = useAuth()
  const [local, setLocal] = useState(() => getLocalLayout())
  const remote = user ? profile?.dashboard_layout : null
  const layout = useMemo(() => normalizeLayout(remote || local), [remote, local])

  const save = useCallback(
    (next) => {
      const clean = normalizeLayout(next)
      setLocal(clean)
      saveLocalLayout(clean)
      if (user) {
        mergeProfile({ dashboard_layout: clean })
        saveProfile(user.id, { dashboard_layout: clean }).catch(() => {})
      }
    },
    [user, mergeProfile]
  )

  const reset = useCallback(() => save(defaultLayout()), [save])

  return { layout, save, reset }
}
