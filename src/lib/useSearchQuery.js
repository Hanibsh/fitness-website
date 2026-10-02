import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

// A search box's text, kept in the URL (`?q=curl`) instead of component state.
//
// The point is the back button: search "curl", open Hammer Curl, go back, and
// the results are still there — component state would have been thrown away
// with the page. Each keystroke REPLACES the history entry rather than pushing
// one, so back still means "the page before", not "one letter ago".
export function useSearchQuery(key = 'q') {
  const [params, setParams] = useSearchParams()
  const value = params.get(key) || ''
  const setValue = useCallback(
    (v) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (v) next.set(key, v)
          else next.delete(key)
          return next
        },
        { replace: true }
      )
    },
    [key, setParams]
  )
  return [value, setValue]
}
