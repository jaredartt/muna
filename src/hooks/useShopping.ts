import { useCallback, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTasksCtx } from '../context/TasksContext'
import { useGoogleEvents } from './useGoogleEvents'
import { addDays, parseDateStr, todayStr } from '../lib/dates'
import { syncShopping } from '../lib/meals'

/**
 * Returns a function that makes (or updates) the one "Grocery shopping" task: everything the planned meals need and the
 * things running low at home. The day is the first one that is not busy (tasks and Google events are both counted).
 */
export function useShopping(): () => Promise<string> {
  const { profile } = useAuth()
  const { tasks, loading, addTask, updateTask, occurrenceMap } = useTasksCtx()
  const today = todayStr()
  const from = useMemo(() => parseDateStr(today), [today])
  const to = useMemo(() => parseDateStr(addDays(today, 9)), [today])
  const google = useGoogleEvents(from, to)
  const latest = useRef({ tasks, loading, events: google.events, occurrenceMap })
  latest.current = { tasks, loading, events: google.events, occurrenceMap }

  return useCallback(async () => {
    if (!profile) return ''
    const { tasks: ts, loading: busy, events, occurrenceMap: occ } = latest.current
    if (busy) return '' // the task list is not loaded yet: never guess
    const days = occ(today, addDays(today, 9))
    const load = (d: string) => (days.get(d)?.length ?? 0) + events.filter((e) => e.start.slice(0, 10) === d).length
    return syncShopping({ householdId: profile.household_id, tasks: ts, addTask, updateTask, load })
  }, [profile, today, addTask, updateTask])
}
