import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TASKS_CHANGED } from '../lib/events'
import { syncTasksToGoogle } from '../lib/google'
import { occurrencesBetween, occursOn } from '../lib/recurrence'
import { addDays } from '../lib/dates'
import type { Occurrence, Task, TaskDraft } from '../lib/types'

export function useTasks() {
  const { profile, googleConnected } = useAuth()
  const householdId = profile?.household_id
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [completions, setCompletions] = useState<Set<string>>(new Set()) // "taskId|YYYY-MM-DD": ticked days of repeating tasks
  const tasksRef = useRef<Task[]>([])
  tasksRef.current = tasks

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
    setCompletions(new Set((done ?? []).map((c) => `${c.task_id}|${c.occ_date}`)))
    setLoading(false)
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
    async (draft: TaskDraft) => {
      if (!householdId) return null
      const { data, error } = await supabase.from('tasks').insert({ ...draft, household_id: householdId }).select('id').single()
      if (error) return error.message
      await reload()
      if (data?.id) mirror([data.id as string])
      return null
    },
    [householdId, reload, mirror],
  )

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
      const { error } = await supabase.from('tasks').update(patch).eq('id', id)
      if (error) await reload()
      else mirror([id])
      return error?.message ?? null
    },
    [reload, mirror],
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
    },
    [reload],
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
      else if (old?.google_event_id && old.google_owner) mirror([], [{ event_id: old.google_event_id, owner: old.google_owner }])
      return error?.message ?? null
    },
    [reload, mirror],
  )

  return { tasks, loading, reload, addTask, updateTask, toggleTask, deleteTask, occurrencesOn, occurrenceMap }
}
