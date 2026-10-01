import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TASKS_CHANGED } from '../lib/events'
import type { Task, TaskDraft } from '../lib/types'

export function useTasks() {
  const { profile } = useAuth()
  const householdId = profile?.household_id
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

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
      .subscribe()
    window.addEventListener(TASKS_CHANGED, reload)
    return () => {
      window.removeEventListener(TASKS_CHANGED, reload)
      supabase.removeChannel(channel)
    }
  }, [householdId, reload])

  const addTask = useCallback(
    async (draft: TaskDraft) => {
      if (!householdId) return
      const { error } = await supabase.from('tasks').insert({ ...draft, household_id: householdId })
      if (!error) await reload()
      return error?.message ?? null
    },
    [householdId, reload],
  )

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
      const { error } = await supabase.from('tasks').update(patch).eq('id', id)
      if (error) await reload()
      return error?.message ?? null
    },
    [reload],
  )

  const toggleTask = useCallback(
    (task: Task) =>
      updateTask(task.id, {
        completed: !task.completed,
        completed_at: !task.completed ? new Date().toISOString() : null,
      }),
    [updateTask],
  )

  const deleteTask = useCallback(
    async (id: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== id))
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) await reload()
      return error?.message ?? null
    },
    [reload],
  )

  return { tasks, loading, reload, addTask, updateTask, toggleTask, deleteTask }
}
