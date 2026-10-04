// Which push notifications are due right now. NO network and no database in here, so it can be tested on its own.
// Times of tasks are "wall clock" times (no time zone); the person's own time zone (from their phone) says what "now" is for them.
import { occursOn, type Repeat } from './recurrence.ts'

export type TaskRow = {
  id: string
  title: string
  assigned_to: string | null
  created_by: string
  due_date: string | null
  start_time: string | null
  remind_minutes: number | null
  completed: boolean
  repeat: Repeat | null
}
export type Settings = { user_id: string; tz: string; tasks_on: boolean; morning_on: boolean; morning_at: string }
export type Due = { kind: 'task' | 'morning'; ref: string; day: string; title: string; body: string; tag: string; url: string }

const DAY = 86400000
export const addDay = (ymd: string, n: number) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10)
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

/** What day and minute of the day it is for someone in this time zone. */
export function localNow(tz: string, now: Date): { date: string; min: number } {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(now)
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(now)
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, min: Number(get('hour')) * 60 + Number(get('minute')) }
}

/** The tasks that are this person's: assigned to them, or assigned to nobody and made by them. */
const mine = (t: TaskRow, uid: string) => (t.assigned_to ? t.assigned_to === uid : t.created_by === uid)

/** Does this task happen on this day, and is it still open that day? (`done` holds "taskId|day" keys of ticked repeat days.) */
function openOn(t: TaskRow, day: string, done: Set<string>): boolean {
  if (t.repeat) return occursOn(t.due_date, t.repeat, day) && !done.has(`${t.id}|${day}`)
  return t.due_date === day && !t.completed
}

const GRACE = 5 // minutes after the start time in which a missed reminder is still sent (the timer may skip a minute)

export function dueNow(s: Settings, tasks: TaskRow[], done: Set<string>, now: Date): Due[] {
  const out: Due[] = []
  const ln = localNow(s.tz, now)
  const url = './#/calendar'

  if (s.tasks_on) {
    for (const off of [0, 1]) {
      const day = addDay(ln.date, off)
      for (const t of tasks) {
        if (!t.start_time || t.remind_minutes == null || !mine(t, s.user_id) || !openOn(t, day, done)) continue
        const startAbs = off * 1440 + toMin(t.start_time)
        const remindAt = startAbs - t.remind_minutes
        if (ln.min < remindAt || ln.min >= startAbs + GRACE) continue
        const inMin = startAbs - ln.min
        out.push({
          kind: 'task',
          ref: `${t.id}@${t.start_time.slice(0, 5)}`,
          day,
          title: t.title,
          body: inMin > 0 ? `Starts at ${t.start_time.slice(0, 5)} · in ${inMin} min` : `Starts now (${t.start_time.slice(0, 5)})`,
          tag: `task-${t.id}`,
          url,
        })
      }
    }
  }

  if (s.morning_on) {
    const at = toMin(s.morning_at)
    if (ln.min >= at && ln.min < at + 90) {
      const todays = tasks
        .filter((t) => mine(t, s.user_id) && openOn(t, ln.date, done))
        .sort((a, b) => (a.start_time ?? '99:99').localeCompare(b.start_time ?? '99:99') || a.title.localeCompare(b.title))
      if (todays.length) {
        const shown = todays.slice(0, 4).map((t) => (t.start_time ? `${t.start_time.slice(0, 5)} ${t.title}` : t.title))
        const more = todays.length - shown.length
        out.push({
          kind: 'morning',
          ref: 'morning',
          day: ln.date,
          title: `Today · ${todays.length} ${todays.length === 1 ? 'thing' : 'things'}`,
          body: shown.join(' · ') + (more > 0 ? ` · +${more} more` : ''),
          tag: 'morning',
          url,
        })
      }
    }
  }
  return out
}

export { hhmm }
