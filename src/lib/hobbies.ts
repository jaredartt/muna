import { supabase } from './supabase'
import { liveTable } from './liveTable'
import type { TimeOfDay } from './hobbyPlan'
import type { Task } from './types'

/** Something you like to do, and when it usually fits. */
export type Hobby = {
  id: string
  household_id: string
  created_by: string
  name: string
  description: string
  icon: string
  color: string
  minutes: number // one session
  per_week: number
  days: number[] // preferred weekdays, 0 = Monday ... 6 = Sunday
  time_of_day: TimeOfDay
  active: boolean
  created_at: string
}

/** One planned time for a hobby (the calendar task it made is task_id). */
export type HobbySession = { id: string; household_id: string; hobby_id: string; created_by: string; task_id: string | null; day: string; week_start: string; created_at: string }

const hobbies = liveTable<Hobby>('hobbies', 'muna.hobbies.v1', (a, b) => a.created_at.localeCompare(b.created_at))
const sessions = liveTable<HobbySession>('hobby_sessions', 'muna.hobbySessions.v1', (a, b) => a.day.localeCompare(b.day))
export const useHobbies = hobbies.use
export const useHobbySessions = sessions.use
export const allHobbies = hobbies.all
export function startHobbySync(householdId: string): () => void {
  const a = hobbies.start(householdId)
  const b = sessions.start(householdId)
  return () => {
    a()
    b()
  }
}

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const TIMES: { key: TimeOfDay; label: string }[] = [
  { key: 'any', label: 'Any time' },
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
]

export type HobbyDraft = Pick<Hobby, 'name' | 'description' | 'icon' | 'color' | 'minutes' | 'per_week' | 'days' | 'time_of_day' | 'active'>
export const emptyHobby = (): HobbyDraft => ({ name: '', description: '', icon: 'IconPaletteFilled', color: 'coral', minutes: 60, per_week: 1, days: [], time_of_day: 'any', active: true })

export async function addHobby(householdId: string, userId: string, d: HobbyDraft): Promise<string | null> {
  const { data, error } = await supabase.from('hobbies').insert({ ...d, name: d.name.trim(), household_id: householdId, created_by: userId }).select().single()
  if (error) return error.message
  hobbies.upsert(data as Hobby)
  return null
}

export async function updateHobby(id: string, patch: Partial<HobbyDraft>): Promise<string | null> {
  const old = hobbies.all().find((h) => h.id === id)
  if (old) hobbies.upsert({ ...old, ...patch })
  const { error } = await supabase.from('hobbies').update(patch).eq('id', id)
  if (error) {
    if (old) hobbies.upsert(old)
    return error.message
  }
  return null
}

/** The calendar tasks of this hobby that are still to do (today or later, not ticked). */
export function openSessionTasks(hobbyId: string, tasks: Task[], today: string): { session: HobbySession; task: Task }[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const out: { session: HobbySession; task: Task }[] = []
  for (const s of sessions.all()) {
    if (s.hobby_id !== hobbyId || !s.task_id) continue
    const t = byId.get(s.task_id)
    if (t && !t.completed && (t.due_date ?? '') >= today) out.push({ session: s, task: t })
  }
  return out
}

export async function deleteHobby(h: Hobby, tasks: Task[], deleteTask: (id: string) => Promise<string | null>, today: string): Promise<string | null> {
  for (const { task } of openSessionTasks(h.id, tasks, today)) await deleteTask(task.id)
  hobbies.remove(h.id)
  const { error } = await supabase.from('hobbies').delete().eq('id', h.id)
  if (error) {
    hobbies.upsert(h)
    return error.message
  }
  for (const s of sessions.all().filter((x) => x.hobby_id === h.id)) sessions.remove(s.id)
  return null
}

export const addSessionRows = (rows: HobbySession[]) => rows.forEach((r) => sessions.upsert(r))
export const removeSessionRows = (ids: string[]) => ids.forEach((id) => sessions.remove(id))
export const allSessions = sessions.all

export function hoursLabel(min: number): string {
  const h = Math.floor(min / 60)
  const r = min % 60
  return h && r ? `${h}h ${r}m` : h ? `${h}h` : `${r}m`
}
