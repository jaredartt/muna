import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTasksCtx } from '../context/TasksContext'
import { useGoogleEvents } from './useGoogleEvents'
import { addDays, parseDateStr } from '../lib/dates'

export type Span = { start: number; end: number }
const clock = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

/** What is already in MY days between two dates (my tasks with times and my Google events), for the planners. `ignore` = tasks that are about to be replaced. */
export function useBusy(from: string, to: string, ignore: Set<string>): (date: string) => Span[] {
  const { session } = useAuth()
  const { tasks, occurrenceMap } = useTasksCtx()
  const uid = session?.user.id ?? ''
  const gFrom = useMemo(() => parseDateStr(addDays(from, -1)), [from])
  const gTo = useMemo(() => parseDateStr(addDays(to < from ? from : to, 2)), [from, to])
  const google = useGoogleEvents(gFrom, gTo)
  return useMemo(() => {
    const occ = from <= to ? occurrenceMap(from, to) : new Map()
    const cache = new Map<string, Span[]>()
    return (d: string): Span[] => {
      const hit = cache.get(d)
      if (hit) return hit
      const spans: Span[] = []
      for (const t of occ.get(d) ?? []) {
        if (!t.start_time || ignore.has(t.id) || (t.assigned_to && t.assigned_to !== uid)) continue
        const s = clock(t.start_time)
        spans.push({ start: s, end: t.end_time ? Math.max(s + 15, clock(t.end_time)) : s + 60 })
      }
      const mid = parseDateStr(d).getTime()
      for (const e of google.events) {
        if (e.all_day || e.owner_id !== uid) continue
        const a = (new Date(e.start).getTime() - mid) / 60000
        const b = (new Date(e.end).getTime() - mid) / 60000
        if (b <= 0 || a >= 1440) continue
        spans.push({ start: Math.max(0, Math.floor(a)), end: Math.min(1440, Math.ceil(b)) })
      }
      cache.set(d, spans)
      return spans
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, google.events, from, to, ignore, uid])
}
