import { useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTasksCtx } from '../context/TasksContext'
import { supabase } from '../lib/supabase'
import { notifyTasksChanged } from '../lib/events'
import { fetchGoogleEvents, syncTasksToGoogle } from '../lib/google'
import { addDays, parseDateStr, todayStr } from '../lib/dates'
import { addSessionRows, allHobbies, removeSessionRows, type HobbySession } from '../lib/hobbies'
import { addDay, mondayOf, planHobbies, type Span } from '../lib/hobbyPlan'

const clock = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export type PlanOutcome = { planned: number; short: string[]; error?: string }

/**
 * Returns a function that plans one week (given by its Monday) for your hobbies and puts the sessions in your calendar.
 * Without options it only plans hobbies that have nothing yet that week. With { replan: true } the sessions that are still to do are
 * taken out first and planned again (after you changed a hobby).
 */
export function useHobbyPlanner() {
  const { session, googleConnected } = useAuth()
  const { tasks, loading, occurrenceMap, deleteTask } = useTasksCtx()
  const latest = useRef({ tasks, loading, occurrenceMap, deleteTask, googleConnected })
  latest.current = { tasks, loading, occurrenceMap, deleteTask, googleConnected }
  const uid = session?.user.id ?? ''
  const running = useRef(false)

  return useCallback(
    async (weekStart: string, opts?: { replan?: boolean; only?: string[] }): Promise<PlanOutcome> => {
      const L = latest.current
      if (!uid || L.loading || running.current) return { planned: 0, short: [] }
      running.current = true
      try {
        const today = todayStr()
        const mine = allHobbies().filter((h) => h.created_by === uid && h.active && (!opts?.only || opts.only.includes(h.id)))
        if (!mine.length) return { planned: 0, short: [] }
        const weekEnd = addDay(weekStart, 6)

        // what is already planned that week (asked fresh, so two devices never plan twice)
        const { data: have, error: e0 } = await supabase.from('hobby_sessions').select('*').in('hobby_id', mine.map((h) => h.id)).gte('day', weekStart).lte('day', weekEnd)
        if (e0) return { planned: 0, short: [], error: e0.message }
        let existing = (have ?? []) as HobbySession[]

        if (opts?.replan) {
          const byId = new Map(L.tasks.map((t) => [t.id, t]))
          const gone: string[] = []
          for (const s of existing) {
            const t = s.task_id ? byId.get(s.task_id) : undefined
            if (s.day >= today && !(t && t.completed)) {
              if (t) await L.deleteTask(t.id)
              gone.push(s.id)
            }
          }
          if (gone.length) {
            await supabase.from('hobby_sessions').delete().in('id', gone)
            removeSessionRows(gone)
            existing = existing.filter((s) => !gone.includes(s.id))
          }
        }

        const todo = mine.filter((h) => opts?.replan || !existing.some((s) => s.hobby_id === h.id))
        if (!todo.length) return { planned: 0, short: [] }
        const days: string[] = []
        for (let d = weekStart; d <= weekEnd; d = addDay(d, 1)) if (d >= today) days.push(d)
        if (!days.length) return { planned: 0, short: [] }

        // what is already in my days
        let events: Awaited<ReturnType<typeof fetchGoogleEvents>>['events'] = []
        if (L.googleConnected) {
          const r = await fetchGoogleEvents(parseDateStr(addDays(days[0], -1)), parseDateStr(addDays(weekEnd, 2)))
          if (r.failed) return { planned: 0, short: [], error: 'Could not read your Google Calendar, so nothing was planned.' }
          events = r.events.filter((e) => e.owner_id === uid && !e.all_day)
        }
        const occ = L.occurrenceMap(days[0], weekEnd)
        const busy = (d: string): Span[] => {
          const spans: Span[] = []
          for (const t of occ.get(d) ?? []) {
            if (!t.start_time || (t.assigned_to && t.assigned_to !== uid)) continue
            const s = clock(t.start_time)
            spans.push({ start: s, end: t.end_time ? Math.max(s + 15, clock(t.end_time)) : s + 60 })
          }
          const mid = parseDateStr(d).getTime()
          for (const e of events) {
            const a = (new Date(e.start).getTime() - mid) / 60000
            const b = (new Date(e.end).getTime() - mid) / 60000
            if (b <= 0 || a >= 1440) continue
            spans.push({ start: Math.max(0, Math.floor(a)), end: Math.min(1440, Math.ceil(b)) })
          }
          return spans
        }

        const now = new Date()
        const result = planHobbies({
          hobbies: todo.map((h) => ({ id: h.id, name: h.name, minutes: h.minutes, perWeek: h.per_week, days: h.days, timeOfDay: h.time_of_day, have: existing.filter((s) => s.hobby_id === h.id).map((s) => s.day) })),
          days,
          today,
          nowMin: now.getHours() * 60 + now.getMinutes(),
          busy,
        })
        const short = result.short.map((s) => todo.find((h) => h.id === s.hobbyId)?.name ?? '')
        if (!result.sessions.length) return { planned: 0, short }

        const byHobby = new Map(todo.map((h) => [h.id, h]))
        const rows = result.sessions.map((s) => {
          const h = byHobby.get(s.hobbyId)!
          return {
            household_id: h.household_id,
            created_by: uid,
            assigned_to: uid,
            title: h.name,
            notes: h.description ? `${h.description}\n(Planned by Muna)` : 'Hobby time (planned by Muna)',
            due_date: s.date,
            start_time: fmt(s.start) + ':00',
            end_time: fmt(s.end) + ':00',
            icon: h.icon,
            color: h.color,
          }
        })
        const { data: made, error } = await supabase.from('tasks').insert(rows).select('id, due_date, start_time')
        if (error) return { planned: 0, short, error: error.message }
        const idOf = new Map((made ?? []).map((r) => [`${r.due_date}|${String(r.start_time).slice(0, 5)}`, r.id as string]))
        const links = result.sessions.map((s) => ({
          household_id: byHobby.get(s.hobbyId)!.household_id,
          hobby_id: s.hobbyId,
          created_by: uid,
          task_id: idOf.get(`${s.date}|${fmt(s.start)}`) ?? null,
          day: s.date,
          week_start: weekStart,
        }))
        const { data: saved, error: e2 } = await supabase.from('hobby_sessions').insert(links).select()
        if (e2) {
          // another device planned first: take our tasks back out so nothing is doubled
          await supabase.from('tasks').delete().in('id', [...idOf.values()])
          notifyTasksChanged()
          return { planned: 0, short, error: undefined }
        }
        addSessionRows((saved ?? []) as HobbySession[])
        notifyTasksChanged()
        if (L.googleConnected && idOf.size) void syncTasksToGoogle([...idOf.values()]).then(() => notifyTasksChanged())
        return { planned: result.sessions.length, short }
      } finally {
        running.current = false
      }
    },
    [uid],
  )
}

/** The weeks Muna looks after right now: this week, and from Saturday also the next one. */
export function weeksToPlan(today: string): string[] {
  const mon = mondayOf(today)
  const wd = (parseDateStr(today).getDay() + 6) % 7
  return wd >= 5 ? [mon, addDay(mon, 7)] : [mon]
}
