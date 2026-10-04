// A linked client's training, as the coach reads it (coach.js fetchClientData).
// Kept for a minute per client, so going from their page to their log and
// back doesn't refetch everything.
import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { fetchClientData, linkForCard } from './coach'
import { NO_INJURIES } from './useInjuries'

const FRESH_MS = 60000
const cache = new Map() // clientUserId -> { at, data }

export function useClientData(clientUserId) {
  const hit = clientUserId ? cache.get(clientUserId) : null
  const [data, setData] = useState(hit?.data || null)
  const [loading, setLoading] = useState(!!clientUserId && !hit)

  useEffect(() => {
    if (!clientUserId) {
      setData(null)
      setLoading(false)
      return
    }
    const cached = cache.get(clientUserId)
    if (cached) setData(cached.data)
    if (cached && Date.now() - cached.at < FRESH_MS) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(!cached)
    fetchClientData(clientUserId).then((d) => {
      cache.set(clientUserId, { at: Date.now(), data: d })
      if (!cancelled) {
        setData(d)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [clientUserId])

  return { data, loading }
}

// One client card's link and, when it's linked, their training — for any page
// under the coach area (CoachLayout's outlet context carries the links).
// `injuries` is the client's own list, ready for an InjuryScope, so the swap
// panels and the generator steer around THEIR body.
export function useLinkedClient(clientId) {
  const { links = [] } = useOutletContext() || {}
  const { state, link } = linkForCard(links, clientId)
  const linked = state === 'linked'
  const { data, loading } = useClientData(linked ? link.client_id : null)
  return { linked, link, linkState: state, data, loading, injuries: data?.injuries || NO_INJURIES }
}
