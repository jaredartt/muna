import { supabase } from './supabase'
import { liveTable } from './liveTable'
import { savePositions } from './order'
import { afterWorkout, type Outcome, type SetIn } from './gymLogic'
import type { TimeOfDay } from './hobbyPlan'
import type { Task } from './types'

export type GymSplit = { id: string; household_id: string; created_by: string; name: string; position: number; created_at: string }
export type GymExercise = {
  id: string
  household_id: string
  created_by: string
  split_id: string
  name: string
  position: number
  sets: number
  weight: number // kg you work with now
  goal_reps: number // the goal: this many reps at that weight
  start_reps: number // where the goal goes back to after a heavier weight
  max_reps: number // reaching this many reps means one step heavier
  step: number // kg
  notes: string
  created_at: string
}
export type GymLog = { id: string; household_id: string; created_by: string; exercise_id: string; day: string; set_no: number; weight: number; reps: number; created_at: string }
export type GymSession = { id: string; household_id: string; created_by: string; split_id: string; task_id: string | null; day: string; done: boolean; created_at: string }
export type GymSettings = { id: string; household_id: string; user_id: string; per_week: number; days: number[]; time_of_day: TimeOfDay; minutes: number; next_index: number }

// Postgres hands numeric columns back as numbers or strings depending on the path: always turn them into numbers.
const num = <T extends object>(row: T, keys: string[]): T => {
  const r = { ...row } as Record<string, unknown>
  for (const k of keys) if (r[k] != null) r[k] = Number(r[k])
  return r as T
}

const byPos = (a: { position: number; created_at: string }, b: { position: number; created_at: string }) => a.position - b.position || a.created_at.localeCompare(b.created_at)
const splits = liveTable<GymSplit>('gym_splits', 'muna.gymSplits.v1', byPos)
const exercises = liveTable<GymExercise>('gym_exercises', 'muna.gymExercises.v1', byPos)
const logs = liveTable<GymLog>('gym_logs', 'muna.gymLogs.v1', (a, b) => a.day.localeCompare(b.day) || a.set_no - b.set_no)
const sessions = liveTable<GymSession>('gym_sessions', 'muna.gymSessions.v1', (a, b) => a.day.localeCompare(b.day))
const settings = liveTable<GymSettings>('gym_settings', 'muna.gymSettings.v1', (a, b) => a.user_id.localeCompare(b.user_id))
export const useGymSplits = splits.use
export const useGymExercises = exercises.use
export const useGymLogs = logs.use
export const useGymSessions = sessions.use
export const useGymSettings = settings.use
export const allGymSplits = splits.all
export const allGymExercises = exercises.all
export const allGymSessions = sessions.all
export const allGymSettings = settings.all
export function startGymSync(householdId: string): () => void {
  const stops = [splits.start(householdId), exercises.start(householdId), logs.start(householdId), sessions.start(householdId), settings.start(householdId)]
  return () => stops.forEach((s) => s())
}

// ---------- splits ----------
export async function addSplit(householdId: string, userId: string, name: string): Promise<{ id?: string; error?: string }> {
  const position = Math.max(-1, ...splits.all().filter((s) => s.created_by === userId).map((s) => s.position)) + 1
  const { data, error } = await supabase.from('gym_splits').insert({ household_id: householdId, created_by: userId, name: name.trim(), position }).select().single()
  if (error) return { error: error.message }
  splits.upsert(data as GymSplit)
  return { id: (data as GymSplit).id }
}
export async function updateSplit(id: string, patch: Partial<Pick<GymSplit, 'name'>>): Promise<string | null> {
  const old = splits.all().find((s) => s.id === id)
  if (old) splits.upsert({ ...old, ...patch })
  const { error } = await supabase.from('gym_splits').update(patch).eq('id', id)
  if (error) {
    if (old) splits.upsert(old)
    return error.message
  }
  return null
}
/** Deleting a split also takes its exercises and its planned (not yet done) calendar tasks with it. Logged sets of its exercises go too. */
export async function deleteSplit(s: GymSplit, tasks: Task[], deleteTask: (id: string) => Promise<string | null>, today: string): Promise<string | null> {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  for (const ss of sessions.all().filter((x) => x.split_id === s.id)) {
    const t = ss.task_id ? byId.get(ss.task_id) : undefined
    if (t && !t.completed && (t.due_date ?? '') >= today) await deleteTask(t.id)
  }
  splits.remove(s.id)
  const { error } = await supabase.from('gym_splits').delete().eq('id', s.id)
  if (error) {
    splits.upsert(s)
    return error.message
  }
  for (const e of exercises.all().filter((x) => x.split_id === s.id)) {
    exercises.remove(e.id)
    for (const l of logs.all().filter((x) => x.exercise_id === e.id)) logs.remove(l.id)
  }
  for (const x of sessions.all().filter((x) => x.split_id === s.id)) sessions.remove(x.id)
  return null
}
export const reorderSplits = (ids: string[]) => savePositions('gym_splits', ids, (id, position) => { const o = splits.all().find((s) => s.id === id); if (o) splits.upsert({ ...o, position }) })

// ---------- exercises ----------
export type ExerciseDraft = Pick<GymExercise, 'name' | 'sets' | 'weight' | 'goal_reps' | 'start_reps' | 'max_reps' | 'step' | 'notes'>
export const emptyExercise = (): ExerciseDraft => ({ name: '', sets: 3, weight: 0, goal_reps: 8, start_reps: 8, max_reps: 11, step: 1, notes: '' })

export async function addExercise(householdId: string, userId: string, splitId: string, d: ExerciseDraft): Promise<string | null> {
  const position = Math.max(-1, ...exercises.all().filter((e) => e.split_id === splitId).map((e) => e.position)) + 1
  const { data, error } = await supabase.from('gym_exercises').insert({ ...d, name: d.name.trim(), household_id: householdId, created_by: userId, split_id: splitId, position }).select().single()
  if (error) return error.message
  exercises.upsert(num(data as GymExercise, ['weight', 'step']))
  return null
}
export async function updateExercise(id: string, patch: Partial<ExerciseDraft>): Promise<string | null> {
  const old = exercises.all().find((e) => e.id === id)
  if (old) exercises.upsert({ ...old, ...patch })
  const { error } = await supabase.from('gym_exercises').update(patch).eq('id', id)
  if (error) {
    if (old) exercises.upsert(old)
    return error.message
  }
  return null
}
export async function deleteExercise(e: GymExercise): Promise<string | null> {
  exercises.remove(e.id)
  const { error } = await supabase.from('gym_exercises').delete().eq('id', e.id)
  if (error) {
    exercises.upsert(e)
    return error.message
  }
  for (const l of logs.all().filter((x) => x.exercise_id === e.id)) logs.remove(l.id)
  return null
}
export const reorderExercises = (ids: string[]) => savePositions('gym_exercises', ids, (id, position) => { const o = exercises.all().find((e) => e.id === id); if (o) exercises.upsert({ ...o, position }) })

// ---------- settings ----------
export const defaultSettings = (): Pick<GymSettings, 'per_week' | 'days' | 'time_of_day' | 'minutes' | 'next_index'> => ({ per_week: 3, days: [], time_of_day: 'any', minutes: 60, next_index: 0 })
export async function saveSettings(householdId: string, userId: string, patch: Partial<Omit<GymSettings, 'id' | 'household_id' | 'user_id'>>): Promise<string | null> {
  const old = settings.all().find((s) => s.user_id === userId)
  const next = { ...defaultSettings(), ...(old ?? {}), ...patch }
  const { data, error } = await supabase.from('gym_settings').upsert({ household_id: householdId, user_id: userId, per_week: next.per_week, days: next.days, time_of_day: next.time_of_day, minutes: next.minutes, next_index: next.next_index }, { onConflict: 'user_id' }).select().single()
  if (error) return error.message
  settings.upsert(data as GymSettings)
  return null
}

// ---------- sessions (planned days) ----------
export async function addSessions(rows: { household_id: string; created_by: string; split_id: string; task_id: string | null; day: string }[]): Promise<string | null> {
  if (!rows.length) return null
  const { data, error } = await supabase.from('gym_sessions').insert(rows).select()
  if (error) return error.message
  for (const r of (data ?? []) as GymSession[]) sessions.upsert(r)
  return null
}
export async function updateSession(id: string, patch: Partial<Pick<GymSession, 'done'>>): Promise<void> {
  const old = sessions.all().find((s) => s.id === id)
  if (old) sessions.upsert({ ...old, ...patch })
  await supabase.from('gym_sessions').update(patch).eq('id', id)
}
export async function removeSessions(ids: string[]): Promise<void> {
  ids.forEach((id) => sessions.remove(id))
  if (ids.length) await supabase.from('gym_sessions').delete().in('id', ids)
}

/** Planned training days that are still to do, soonest first (the calendar task is still open). */
export function upcomingSessions(uid: string, tasks: Task[], today: string): { session: GymSession; split: GymSplit; task: Task | null }[] {
  const byTask = new Map(tasks.map((t) => [t.id, t]))
  const sp = new Map(splits.all().map((s) => [s.id, s]))
  const out: { session: GymSession; split: GymSplit; task: Task | null }[] = []
  for (const s of sessions.all()) {
    if (s.created_by !== uid || s.done || s.day < today) continue
    const split = sp.get(s.split_id)
    if (!split) continue
    const task = s.task_id ? byTask.get(s.task_id) ?? null : null
    if (s.task_id && !task) continue // its calendar task was deleted
    if (task?.completed) continue
    out.push({ session: s, split, task })
  }
  return out.sort((a, b) => a.session.day.localeCompare(b.session.day) || (a.task?.start_time ?? '').localeCompare(b.task?.start_time ?? ''))
}

// ---------- doing a workout ----------
export type WorkoutEntry = { exercise: GymExercise; sets: SetIn[] }
export type WorkoutResult = { exercise: GymExercise; outcome: Outcome }

/** Saves the sets, moves every goal (one more rep when reached, never down), and ticks the planned day. */
export async function saveWorkout(o: {
  householdId: string
  userId: string
  day: string
  entries: WorkoutEntry[]
  session: GymSession | null
  task: Task | null
  toggleTask: (t: Task) => Promise<unknown>
}): Promise<{ error?: string; results: WorkoutResult[] }> {
  const rows = o.entries.flatMap((e) =>
    e.sets
      .filter((s) => s.reps > 0)
      .map((s, i) => ({ household_id: o.householdId, created_by: o.userId, exercise_id: e.exercise.id, day: o.day, set_no: i + 1, weight: s.weight, reps: s.reps })),
  )
  if (rows.length) {
    const { data, error } = await supabase.from('gym_logs').insert(rows).select()
    if (error) return { error: error.message, results: [] }
    for (const l of (data ?? []) as GymLog[]) logs.upsert(num(l, ['weight']))
  }
  const results: WorkoutResult[] = []
  for (const e of o.entries) {
    const outcome = afterWorkout(e.exercise, e.sets)
    results.push({ exercise: e.exercise, outcome })
    if (outcome.weight !== e.exercise.weight || outcome.goal_reps !== e.exercise.goal_reps) await updateExercise(e.exercise.id, { weight: outcome.weight, goal_reps: outcome.goal_reps })
  }
  if (o.session && !o.session.done) await updateSession(o.session.id, { done: true })
  if (o.task && !o.task.completed) await o.toggleTask(o.task)
  return { results }
}

/** Takes one day's sets of an exercise back out (a wrong entry). The goal does not move back. */
export async function deleteDayLogs(exerciseId: string, day: string): Promise<string | null> {
  const mine = logs.all().filter((l) => l.exercise_id === exerciseId && l.day === day)
  mine.forEach((l) => logs.remove(l.id))
  const { error } = await supabase.from('gym_logs').delete().eq('exercise_id', exerciseId).eq('day', day)
  if (error) {
    mine.forEach((l) => logs.upsert(l))
    return error.message
  }
  return null
}
