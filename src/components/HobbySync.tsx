import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTasksCtx } from '../context/TasksContext'
import { useHobbies } from '../lib/hobbies'
import { todayStr } from '../lib/dates'
import { useHobbyPlanner, weeksToPlan } from '../hooks/useHobbyPlanner'

// Plans the hobby sessions in the background (renders nothing): this week once you have hobbies, and from Saturday the next week.
// Weeks that already have sessions for a hobby are never touched.
export default function HobbySync() {
  const { session } = useAuth()
  const { loading } = useTasksCtx()
  const plan = useHobbyPlanner()
  const uid = session?.user.id
  const key = useHobbies()
    .filter((h) => h.created_by === uid && h.active)
    .map((h) => h.id)
    .join(',')
  useEffect(() => {
    if (!uid || !key || loading) return
    const t = window.setTimeout(async () => {
      for (const ws of weeksToPlan(todayStr())) await plan(ws)
    }, 4000 + Math.random() * 3000)
    return () => window.clearTimeout(t)
  }, [uid, key, loading, plan])
  return null
}
