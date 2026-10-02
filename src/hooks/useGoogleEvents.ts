import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { TASKS_CHANGED } from '../lib/events'
import { fetchGoogleEvents, type GoogleEvent } from '../lib/google'

const cache = new Map<string, { at: number; events: GoogleEvent[]; reconnect: string[]; apiDisabled: boolean }>()
const TTL = 60_000

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
      if (!r.failed) cache.set(key, { at: Date.now(), events: r.events, reconnect: r.reconnect, apiDisabled: r.apiDisabled })
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
