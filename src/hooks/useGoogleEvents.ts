import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { TASKS_CHANGED } from '../lib/events'
import { fetchGoogleEvents, type GoogleEvent } from '../lib/google'

const cache = new Map<string, { at: number; events: GoogleEvent[]; reconnect: string[]; apiDisabled: boolean }>()
const TTL = 60_000
const STORE = 'muna.googleEvents.v1'
type Entry = { events: GoogleEvent[]; reconnect: string[]; apiDisabled: boolean }
// What we saw last time is shown at once (as "old"), then refreshed from Google.
try {
  const saved = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, Entry>
  for (const [k, v] of Object.entries(saved)) cache.set(k, { at: 0, ...v })
} catch {
  /* nothing saved yet */
}
function persist() {
  try {
    const recent = [...cache.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, 6)
    localStorage.setItem(STORE, JSON.stringify(Object.fromEntries(recent.map(([k, v]) => [k, { events: v.events, reconnect: v.reconnect, apiDisabled: v.apiDisabled }]))))
  } catch {
    /* fine */
  }
}

/** Google Calendar events (everyone in the home who connected Google) between two moments. */
export function useGoogleEvents(from: Date, to: Date) {
  const { anyGoogleConnected, googleReady } = useAuth()
  const key = `${from.getTime()}-${to.getTime()}`
  const [state, setState] = useState(() => {
    const hit = cache.get(key)
    return { events: hit?.events ?? [], reconnect: hit?.reconnect ?? [], apiDisabled: hit?.apiDisabled ?? false, loading: false, loaded: Boolean(hit) }
  })

  const load = useCallback(
    async (force = false) => {
      if (!anyGoogleConnected) {
        setState({ events: [], reconnect: [], apiDisabled: false, loading: false, loaded: googleReady })
        return
      }
      const hit = cache.get(key)
      if (!force && hit && Date.now() - hit.at < TTL) {
        setState({ events: hit.events, reconnect: hit.reconnect, apiDisabled: hit.apiDisabled, loading: false, loaded: true })
        return
      }
      setState((s) => ({ ...s, loading: true }))
      const r = await fetchGoogleEvents(from, to)
      if (!r.failed) {
        cache.set(key, { at: Date.now(), events: r.events, reconnect: r.reconnect, apiDisabled: r.apiDisabled })
        persist()
      }
      setState({ events: r.failed ? [] : r.events, reconnect: r.reconnect, apiDisabled: r.apiDisabled, loading: false, loaded: true })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anyGoogleConnected, googleReady, key],
  )

  useEffect(() => {
    void load()
    const onChange = () => {
      cache.clear()
      void load(true)
    }
    window.addEventListener(TASKS_CHANGED, onChange)
    return () => window.removeEventListener(TASKS_CHANGED, onChange)
  }, [load])

  return { ...state, reload: () => load(true) }
}
