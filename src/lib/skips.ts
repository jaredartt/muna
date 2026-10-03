import { supabase } from './supabase'
import { liveTable } from './liveTable'

/** A day you do not want Muna to plan anything on (one list per person and per planner). */
export type PlanSkip = { id: string; household_id: string; user_id: string; area: 'uni' | 'gym' | 'hobbies'; day: string }
export type SkipArea = PlanSkip['area']

const store = liveTable<PlanSkip>('plan_skips', 'muna.planSkips.v1', (a, b) => a.day.localeCompare(b.day))
export const startSkipSync = store.start

const daysOf = (all: PlanSkip[], area: SkipArea, uid: string) => all.filter((s) => s.area === area && s.user_id === uid).map((s) => s.day)
/** The days this person skips for one planner (for components). */
export function useSkips(area: SkipArea, uid: string): string[] {
  return daysOf(store.use(), area, uid)
}
/** Same, for code outside components (the planners). */
export const skippedDays = (area: SkipArea, uid: string): string[] => daysOf(store.all(), area, uid)

/** Turns one day on or off. */
export async function toggleSkip(householdId: string, uid: string, area: SkipArea, day: string): Promise<string | null> {
  const have = store.all().find((s) => s.area === area && s.user_id === uid && s.day === day)
  if (have) {
    store.remove(have.id)
    const { error } = await supabase.from('plan_skips').delete().eq('id', have.id)
    if (error) {
      store.upsert(have)
      return error.message
    }
    return null
  }
  const { data, error } = await supabase.from('plan_skips').insert({ household_id: householdId, user_id: uid, area, day }).select().single()
  if (error) return error.message
  store.upsert(data as PlanSkip)
  return null
}
