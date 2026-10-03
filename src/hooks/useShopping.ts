import { useCallback, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTasksCtx } from '../context/TasksContext'
import { useGoogleEvents } from './useGoogleEvents'
import { addDays, parseDateStr, todayStr } from '../lib/dates'
import { collectNeeds, planTrips, SHOPPING_TITLE, syncShopping, usePantry, usePantryLog, usePlan, useRecipes, type Trip } from '../lib/meals'
import { useProducts } from '../lib/products'

/** How busy each of the next days is (tasks and Google events of both of you). Used to pick a quiet day for shopping. */
function useDayLoad() {
  const { tasks, loading, occurrenceMap } = useTasksCtx()
  const today = todayStr()
  const from = useMemo(() => parseDateStr(today), [today])
  const to = useMemo(() => parseDateStr(addDays(today, 16)), [today])
  const google = useGoogleEvents(from, to)
  const load = useMemo(() => {
    const days = occurrenceMap(today, addDays(today, 16))
    return (d: string) => (days.get(d)?.length ?? 0) + google.events.filter((e) => e.start.slice(0, 10) === d).length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, google.events, today])
  return { load, loading, tasks, today }
}

/**
 * Returns a function that makes (or updates) the one "Grocery shopping" task. With no options it makes the task when there is none
 * (a button was pressed); with { create: false } it only keeps an existing task up to date.
 */
export function useShopping(): (opts?: { create?: boolean; day?: string }) => Promise<string> {
  const { profile } = useAuth()
  const { tasks, loading, addTask, updateTask } = useTasksCtx()
  const { load } = useDayLoad()
  const latest = useRef({ tasks, loading, load })
  latest.current = { tasks, loading, load }

  return useCallback(
    async (opts) => {
      if (!profile) return ''
      const { tasks: ts, loading: busy, load: l } = latest.current
      if (busy) return '' // the task list is not loaded yet: never guess
      return syncShopping({ householdId: profile.household_id, tasks: ts, addTask, updateTask, load: l, create: opts?.create, day: opts?.day })
    },
    [profile, addTask, updateTask],
  )
}

/** Muna's suggested shopping trips (live: they change when a slider moves, a meal is planned or your days fill up). Empty once a shopping task exists. */
export function useShoppingPlan(): { trips: Trip[]; load: (d: string) => number; hasTask: boolean; ready: boolean } {
  const { load, loading, tasks, today } = useDayLoad()
  const pantry = usePantry()
  const log = usePantryLog()
  const plan = usePlan()
  const recipes = useRecipes()
  const products = useProducts()
  const hasTask = tasks.some((t) => t.title === SHOPPING_TITLE && !t.completed && !t.repeat) // also one you pushed or that is overdue
  const trips = useMemo(
    () => (loading ? [] : planTrips(collectNeeds(today), today, load)),
    // the stores are read inside collectNeeds; these are here so the plan is worked out again when any of them changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pantry, log, plan, recipes, products, load, loading, today],
  )
  return { trips, load, hasTask, ready: !loading }
}
