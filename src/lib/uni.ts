import { supabase } from './supabase'
import { liveTable } from './liveTable'
import { syncTasksToGoogle } from './google'
import { notifyTasksChanged } from './events'
import type { Block } from './uniPlan'
import type { Task } from './types'

/** One assignment or reading of a Uni week, and the time you plan to spend on it. */
export type UniItem = {
  id: string
  household_id: string
  created_by: string
  week: number
  title: string
  minutes: number
  done: boolean
  task_ids: string[] // the calendar tasks Muna made when she planned it
  created_at: string
}

/** Which Uni week a person is in now. */
export type UniSetting = { id: string; household_id: string; user_id: string; current_week: number }
const settings = liveTable<UniSetting>('uni_settings', 'muna.uniSettings.v1', (a, b) => a.user_id.localeCompare(b.user_id))
export const useUniSettings = settings.use

const store = liveTable<UniItem>('uni_items', 'muna.uni.v1', (a, b) => a.week - b.week || a.created_at.localeCompare(b.created_at))
export const useUniItems = store.use
export function startUniSync(householdId: string): () => void {
  const a = store.start(householdId)
  const b = settings.start(householdId)
  return () => {
    a()
    b()
  }
}

export async function setCurrentWeek(householdId: string, userId: string, week: number): Promise<string | null> {
  const { data, error } = await supabase.from('uni_settings').upsert({ household_id: householdId, user_id: userId, current_week: week }, { onConflict: 'user_id' }).select().single()
  if (error) return error.message
  settings.upsert(data as UniSetting)
  return null
}

/** The week you are in: the one you chose, else the first week that still has something to do, else the last week. */
export function currentWeekOf(items: UniItem[], tasks: Task[], setting: UniSetting | undefined, today: string): number | null {
  if (setting) return setting.current_week
  const weeks = [...new Set(items.map((i) => i.week))].sort((a, b) => a - b)
  if (!weeks.length) return null
  return weeks.find((w) => items.some((i) => i.week === w && !itemState(i, tasks, today).done)) ?? weeks[weeks.length - 1]
}

const dayNum = (s: string) => Math.floor(Date.parse(s + 'T00:00:00Z') / 86400000)
/** The Monday of the week a date is in. */
const mondayOf = (s: string) => new Date((dayNum(s) - ((new Date(s + 'T00:00:00Z').getUTCDay() + 6) % 7)) * 86400000).toISOString().slice(0, 10)

/**
 * Tasks you marked "Uni" yourself (not the ones Muna planned from your list) that belong to this week: due this week, or overdue and not done.
 * They count in the Uni block with the time they take (30 minutes when they have no times).
 */
export function looseUniTasks(items: UniItem[], tasks: Task[], userId: string, today: string): Task[] {
  const linked = new Set(items.flatMap((i) => i.task_ids))
  const mon = mondayOf(today)
  const sun = new Date((dayNum(mon) + 6) * 86400000).toISOString().slice(0, 10)
  return tasks.filter(
    (t) =>
      t.category === 'uni' &&
      !t.repeat &&
      !linked.has(t.id) &&
      (!t.assigned_to || t.assigned_to === userId) &&
      t.due_date != null &&
      ((t.due_date >= mon && t.due_date <= sun) || (t.due_date < mon && !t.completed)),
  )
}

/** Minutes done and minutes planned in total for one week (items count by the time you planned for them; loose Uni tasks count in your current week). */
export function weekProgress(items: UniItem[], tasks: Task[], week: number, today: string, loose: Task[] = []): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const t of loose) {
    const m = taskMinutes(t)
    total += m
    if (t.completed) done += m
  }
  for (const i of items) {
    if (i.week !== week) continue
    const st = itemState(i, tasks, today)
    total += i.minutes
    done += st.done ? i.minutes : Math.min(i.minutes, st.doneMin)
  }
  return { done, total }
}

const mins = (t: string | null) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : 0)
export const taskMinutes = (t: Task) => (t.start_time && t.end_time ? Math.max(0, mins(t.end_time) - mins(t.start_time)) : 30)

export function fmtMin(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
/** 90 -> "1h 30m", 120 -> "2h", 45 -> "45m" */
export function duration(m: number): string {
  const h = Math.floor(m / 60)
  const r = Math.round(m % 60)
  return h && r ? `${h}h ${r}m` : h ? `${h}h` : `${r}m`
}

export type UniState = {
  linked: Task[]
  upcoming: Task[] // planned blocks that are still to do (today or later)
  doneMin: number // minutes of its planned blocks that are ticked
  remaining: number // minutes still to plan or do
  done: boolean
  planned: boolean
}

export function itemState(item: UniItem, tasks: Task[], today: string): UniState {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const linked = item.task_ids.map((id) => byId.get(id)).filter((t): t is Task => Boolean(t))
  const doneMin = linked.filter((t) => t.completed).reduce((a, t) => a + taskMinutes(t), 0)
  const upcoming = linked.filter((t) => !t.completed && (t.due_date ?? '') >= today).sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '') || (a.start_time ?? '').localeCompare(b.start_time ?? ''))
  const done = item.done || (linked.length > 0 && linked.every((t) => t.completed) && doneMin >= item.minutes)
  return { linked, upcoming, doneMin, remaining: done ? 0 : Math.max(0, item.minutes - doneMin), done, planned: upcoming.length > 0 }
}

export async function addUniItem(householdId: string, userId: string, week: number, title: string, minutes: number): Promise<string | null> {
  const { data, error } = await supabase.from('uni_items').insert({ household_id: householdId, created_by: userId, week, title: title.trim(), minutes }).select().single()
  if (error) return error.message
  store.upsert(data as UniItem)
  return null
}

export async function updateUniItem(id: string, patch: Partial<Pick<UniItem, 'title' | 'minutes' | 'week' | 'done' | 'task_ids'>>): Promise<string | null> {
  const old = store.all().find((i) => i.id === id)
  if (old) store.upsert({ ...old, ...patch })
  const { error } = await supabase.from('uni_items').update(patch).eq('id', id)
  if (error) {
    if (old) store.upsert(old)
    return error.message
  }
  return null
}

export async function deleteUniItem(id: string): Promise<string | null> {
  const old = store.all().find((i) => i.id === id)
  store.remove(id)
  const { error } = await supabase.from('uni_items').delete().eq('id', id)
  if (error) {
    if (old) store.upsert(old)
    return error.message
  }
  return null
}

type Ctx = {
  householdId: string
  userId: string
  items: UniItem[]
  tasks: Task[]
  googleConnected: boolean
  deleteTask: (id: string) => Promise<string | null>
  color: string // the colour of the person (Jared orange, Lidia purple)
}

/** Remove the blocks of an item that are still to do (ticked ones stay as a record). */
export async function unplanItem(item: UniItem, ctx: Pick<Ctx, 'tasks' | 'deleteTask'>, today: string): Promise<void> {
  const st = itemState(item, ctx.tasks, today)
  // blocks that are still open, including missed ones from the past
  const open = st.linked.filter((t) => !t.completed)
  for (const t of open) await ctx.deleteTask(t.id)
  await updateUniItem(item.id, { task_ids: st.linked.filter((t) => t.completed).map((t) => t.id) })
}

/** Turn a plan into real calendar tasks (they also go to Google Calendar if you connected it). */
export async function commitPlan(blocks: Block[], replan: UniItem[], ctx: Ctx, today: string): Promise<string | null> {
  for (const it of replan) await unplanItem(it, ctx, today)
  if (!blocks.length) return null
  const byId = new Map(ctx.items.map((i) => [i.id, i]))
  const rows = blocks.map((b) => {
    const it = byId.get(b.itemId)
    return {
      household_id: ctx.householdId,
      created_by: ctx.userId,
      assigned_to: ctx.userId,
      title: b.parts > 1 ? `${b.title} (${b.part}/${b.parts})` : b.title,
      notes: `Uni · week ${it?.week ?? ''} · planned by Muna (${duration(it?.minutes ?? b.end - b.start)} for the whole item)`,
      due_date: b.date,
      start_time: fmtMin(b.start) + ':00',
      end_time: fmtMin(b.end) + ':00',
      icon: 'school',
      color: ctx.color,
      category: 'uni',
    }
  })
  const { data, error } = await supabase.from('tasks').insert(rows).select('id, due_date, start_time')
  if (error) return error.message
  const idOf = new Map((data ?? []).map((r) => [`${r.due_date}|${String(r.start_time).slice(0, 5)}`, r.id as string]))
  const allNew: string[] = []
  const perItem = new Map<string, string[]>()
  for (const b of blocks) {
    const id = idOf.get(`${b.date}|${fmtMin(b.start)}`)
    if (!id) continue
    allNew.push(id)
    perItem.set(b.itemId, [...(perItem.get(b.itemId) ?? []), id])
  }
  for (const [itemId, ids] of perItem) {
    const it = store.all().find((i) => i.id === itemId)
    const kept = it ? it.task_ids.filter((id) => ctx.tasks.find((t) => t.id === id)?.completed) : []
    await updateUniItem(itemId, { task_ids: [...kept, ...ids] })
  }
  notifyTasksChanged()
  if (ctx.googleConnected && allNew.length) void syncTasksToGoogle(allNew).then(() => notifyTasksChanged())
  return null
}
