import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TASKS_CHANGED } from '../lib/events'
import { syncTasksToGoogle } from '../lib/google'
import { occurrencesBetween, occursOn } from '../lib/recurrence'
import { addDays } from '../lib/dates'
import { syncUniMinutes } from '../lib/uni'
import type { Occurrence, Task, TaskDraft } from '../lib/types'

// Undo / redo of the last few changes to tasks (kept in memory, up to 3). One entry = one thing you did (it can hold several steps).
type Op =
  | { k: 'upd'; id: string; before: Partial<Task>; after: Partial<Task> }
  | { k: 'add'; task: Task }
  | { k: 'del'; task: Task }
  | { k: 'occ'; series: Task; date: string; now: boolean }
type Entry = { ops: Op[]; at: number }
const HISTORY_MAX = 3
const MERGE_MS = 8000 // edits to the same task in quick succession (typing in the sheet) count as one; moving a task never merges

const CACHE = 'muna.tasksCache.v1'
type TaskCache = { hid: string; tasks: Task[]; done: string[] }
function readCache(hid: string | undefined): TaskCache | null {
  if (!hid) return null
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) ?? 'null') as TaskCache | null
    return c && c.hid === hid && Array.isArray(c.tasks) ? c : null
  } catch {
    return null
  }
}

export function useTasks() {
  const { profile, googleConnected } = useAuth()
  const householdId = profile?.household_id
  // The last list we saw is shown straight away (so the app opens instantly); the fresh list replaces it a moment later.
  const [first] = useState(() => readCache(householdId))
  const [tasks, setTasks] = useState<Task[]>(first?.tasks ?? [])
  const [loading, setLoading] = useState(!first)
  const [completions, setCompletions] = useState<Set<string>>(new Set(first?.done ?? [])) // "taskId|YYYY-MM-DD": ticked days of repeating tasks
  const tasksRef = useRef<Task[]>([])
  tasksRef.current = tasks

  // ---- undo / redo ----
  const past = useRef<Entry[]>([])
  const future = useRef<Entry[]>([])
  const group = useRef<Op[] | null>(null) // while set, steps are collected into one entry
  const replaying = useRef(false) // true while undoing / redoing (those steps are not recorded again)
  const [, setHv] = useState(0)
  const record = useCallback((op: Op) => {
    if (replaying.current) return
    if (group.current) {
      group.current.push(op)
      return
    }
    const last = past.current[past.current.length - 1]
    const now = Date.now()
    if (op.k === 'upd' && !('start_time' in op.after || 'due_date' in op.after) && last && last.ops.length === 1 && last.ops[0].k === 'upd' && (last.ops[0] as Extract<Op, { k: "upd" }>).id === op.id && now - last.at < MERGE_MS) {
      const o = last.ops[0] as Extract<Op, { k: 'upd' }>
      o.before = { ...op.before, ...o.before }
      o.after = { ...o.after, ...op.after }
      last.at = now
    } else {
      past.current = [...past.current, { ops: [op], at: now }].slice(-HISTORY_MAX)
    }
    future.current = []
    setHv((n) => n + 1)
  }, [])

  const reload = useCallback(async () => {
    if (!householdId) return
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('household_id', householdId)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('start_time', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
    setTasks((data ?? []) as Task[])
    const { data: done } = await supabase.from('task_completions').select('task_id, occ_date').eq('household_id', householdId).gte('occ_date', addDays(new Date().toISOString().slice(0, 10), -800))
    const doneKeys = (done ?? []).map((c) => `${c.task_id}|${c.occ_date}`)
    setCompletions(new Set(doneKeys))
    setLoading(false)
    try {
      localStorage.setItem(CACHE, JSON.stringify({ hid: householdId, tasks: data ?? [], done: doneKeys }))
    } catch {
      /* storage full or blocked, fine */
    }
  }, [householdId])

  useEffect(() => {
    reload()
    if (!householdId) return
    const channel = supabase
      .channel(`tasks-${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `household_id=eq.${householdId}` }, () => {
        reload()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_completions', filter: `household_id=eq.${householdId}` }, () => {
        reload()
      })
      .subscribe()
    window.addEventListener(TASKS_CHANGED, reload)
    return () => {
      window.removeEventListener(TASKS_CHANGED, reload)
      supabase.removeChannel(channel)
    }
  }, [householdId, reload])

  // Mirror to Google Calendar in the background (only if this person connected it).
  const mirror = useCallback(
    (ids: string[], deletes: { event_id: string; owner: string }[] = []) => {
      if (!googleConnected) return
      void syncTasksToGoogle(ids, deletes).then(() => reload())
    },
    [googleConnected, reload],
  )

  const addTask = useCallback(
    async (draft: TaskDraft, after?: (id: string) => Promise<void>) => {
      if (!householdId) return null
      const { data, error } = await supabase.from('tasks').insert({ ...draft, household_id: householdId }).select('*').single()
      if (error) return error.message
      if (data) record({ k: 'add', task: data as Task })
      if (data?.id && after) await after(data.id as string)
      await reload()
      if (data?.id) mirror([data.id as string])
      return null
    },
    [householdId, reload, mirror, record],
  )

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      const old = tasksRef.current.find((t) => t.id === id)
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
      const { error } = await supabase.from('tasks').update(patch).eq('id', id)
      if (error) await reload()
      else {
        if (old) {
          const before: Record<string, unknown> = {}
          for (const k of Object.keys(patch)) before[k] = (old as Record<string, unknown>)[k] ?? null
          record({ k: 'upd', id, before: before as Partial<Task>, after: patch })
        }
        mirror([id])
        // a Uni block got a new time: its assignment in Uni takes the new duration
        if ('start_time' in patch || 'end_time' in patch) void syncUniMinutes(id, tasksRef.current.map((t) => (t.id === id ? { ...t, ...patch } : t)))
      }
      return error?.message ?? null
    },
    [reload, mirror, record],
  )

  // Repeating tasks: every day has its own tick.
  const toggleOccurrence = useCallback(
    async (series: Task, date: string, nowDone: boolean) => {
      const key = `${series.id}|${date}`
      setCompletions((prev) => {
        const next = new Set(prev)
        if (nowDone) next.add(key)
        else next.delete(key)
        return next
      })
      const { error } = nowDone
        ? await supabase.from('task_completions').upsert({ task_id: series.id, occ_date: date, household_id: series.household_id })
        : await supabase.from('task_completions').delete().eq('task_id', series.id).eq('occ_date', date)
      if (error) await reload()
      else record({ k: 'occ', series, date, now: nowDone })
    },
    [reload, record],
  )

  const toggleTask = useCallback(
    (task: Task | Occurrence) => {
      const occ = task as Occurrence
      if (occ.series && occ.due_date) return toggleOccurrence(occ.series, occ.due_date, !occ.completed)
      return updateTask(task.id, {
        completed: !task.completed,
        completed_at: !task.completed ? new Date().toISOString() : null,
      })
    },
    [updateTask, toggleOccurrence],
  )

  /** Everything that happens on one day: normal tasks plus the repeats that fall on it. */
  const occurrencesOn = useCallback(
    (date: string): Occurrence[] => {
      const out: Occurrence[] = []
      for (const t of tasks) {
        if (t.repeat) {
          if (occursOn(t.due_date, t.repeat, date)) out.push({ ...t, due_date: date, completed: completions.has(`${t.id}|${date}`), series: t })
        } else if (t.due_date === date) out.push(t)
      }
      return out
    },
    [tasks, completions],
  )

  /** Same, for a whole range of days at once (date -> things on that day). */
  const occurrenceMap = useCallback(
    (from: string, to: string): Map<string, Occurrence[]> => {
      const map = new Map<string, Occurrence[]>()
      const put = (d: string, o: Occurrence) => map.set(d, [...(map.get(d) ?? []), o])
      for (const t of tasks) {
        if (t.repeat) {
          for (const d of occurrencesBetween(t.due_date, t.repeat, from, to)) put(d, { ...t, due_date: d, completed: completions.has(`${t.id}|${d}`), series: t })
        } else if (t.due_date && t.due_date >= from && t.due_date <= to) put(t.due_date, t)
      }
      return map
    },
    [tasks, completions],
  )

  const deleteTask = useCallback(
    async (id: string) => {
      const old = tasksRef.current.find((t) => t.id === id)
      setTasks((prev) => prev.filter((t) => t.id !== id))
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) await reload()
      else {
        if (old) record({ k: 'del', task: old })
        if (old?.google_event_id && old.google_owner) mirror([], [{ event_id: old.google_event_id, owner: old.google_owner }])
      }
      return error?.message ?? null
    },
    [reload, mirror, record],
  )

  // Puts a deleted task back (same id; its Google event is made again).
  const reinsert = useCallback(
    async (task: Task) => {
      const { error } = await supabase.from('tasks').insert({ ...task, google_event_id: null, google_owner: null })
      if (error) return error.message
      await reload()
      mirror([task.id])
      return null
    },
    [reload, mirror],
  )

  /** Everything done inside `fn` becomes ONE undo step (for example moving a single repeat day: a new task plus a change of the series). */
  const batch = useCallback(async (fn: () => Promise<void>) => {
    group.current = []
    try {
      await fn()
    } finally {
      const ops = group.current ?? []
      group.current = null
      if (ops.length) {
        past.current = [...past.current, { ops, at: Date.now() }].slice(-HISTORY_MAX)
        future.current = []
        setHv((n) => n + 1)
      }
    }
  }, [])

  const run = useCallback(
    async (ops: Op[], forward: boolean): Promise<string | null> => {
      replaying.current = true
      let err: string | null = null
      try {
        for (const op of forward ? ops : [...ops].reverse()) {
          if (op.k === 'upd') err = (await updateTask(op.id, forward ? op.after : op.before)) ?? err
          else if (op.k === 'occ') await toggleOccurrence(op.series, op.date, forward ? op.now : !op.now)
          else if ((op.k === 'add') === forward) err = (await reinsert(op.task)) ?? err
          else err = (await deleteTask(op.task.id)) ?? err
        }
      } finally {
        replaying.current = false
      }
      return err
    },
    [updateTask, toggleOccurrence, reinsert, deleteTask],
  )

  /** Takes back the last change. Returns an error text, or null. */
  const undo = useCallback(async () => {
    const e = past.current[past.current.length - 1]
    if (!e) return null
    past.current = past.current.slice(0, -1)
    future.current = [...future.current, e]
    setHv((n) => n + 1)
    return run(e.ops, false)
  }, [run])
  const redo = useCallback(async () => {
    const e = future.current[future.current.length - 1]
    if (!e) return null
    future.current = future.current.slice(0, -1)
    past.current = [...past.current, e].slice(-HISTORY_MAX)
    setHv((n) => n + 1)
    return run(e.ops, true)
  }, [run])

  return { tasks, loading, reload, addTask, updateTask, toggleTask, deleteTask, occurrencesOn, occurrenceMap, undo, redo, batch, canUndo: past.current.length > 0, canRedo: future.current.length > 0 }
}
