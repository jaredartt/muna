import { supabase } from './supabase'
import { liveTable } from './liveTable'
import { addDays, parseDateStr } from './dates'

/** One morning of one person. day = the day you woke up. Times are "HH:MM:SS". Only times the person typed in are stored. */
export type SleepRow = { id: string; household_id: string; user_id: string; day: string; bed_time: string; wake_time: string; created_at: string }

const store = liveTable<SleepRow>('sleep_log', 'muna.sleep.v1', (a, b) => a.day.localeCompare(b.day))
export const useSleep = store.use
export const startSleepSync = store.start

export const SLEEP_GOAL_MIN = 8 * 60

/** The suggestion shown before you type anything. NOT saved and never counted. Weekend mornings (Sat, Sun) are later. */
export function sleepDefaults(day: string): { bed: string; wake: string } {
  const wd = parseDateStr(day).getDay() // 0 Sun, 6 Sat
  return wd === 0 || wd === 6 ? { bed: '00:00', wake: '08:00' } : { bed: '22:00', wake: '06:00' }
}

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

/** Minutes slept between going to bed and waking up (crossing midnight is fine: 22:00 to 06:00 = 8 h). */
export function sleepMinutes(bed: string, wake: string): number {
  const d = mins(wake) - mins(bed)
  return d > 0 ? d : d + 24 * 60
}

export const hm = (m: number) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`

/** Average sleep of this person over the 7 mornings up to today (only nights that were logged). */
export function sleepAverage(rows: SleepRow[], userId: string, today: string): { avg: number | null; nights: number } {
  const from = addDays(today, -6)
  const mine = rows.filter((r) => r.user_id === userId && r.day >= from && r.day <= today)
  if (!mine.length) return { avg: null, nights: 0 }
  const total = mine.reduce((a, r) => a + sleepMinutes(r.bed_time, r.wake_time), 0)
  return { avg: total / mine.length, nights: mine.length }
}

export async function saveSleep(householdId: string, userId: string, day: string, bed: string, wake: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('sleep_log')
    .upsert({ household_id: householdId, user_id: userId, day, bed_time: bed, wake_time: wake }, { onConflict: 'user_id,day' })
    .select()
    .single()
  if (error) return error.message
  store.upsert(data as SleepRow)
  return null
}

export async function deleteSleep(id: string): Promise<string | null> {
  const { error } = await supabase.from('sleep_log').delete().eq('id', id)
  if (error) return error.message
  store.remove(id)
  return null
}
