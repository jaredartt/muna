import { supabase } from './supabase'
import { addDays, parseDateStr, pad, toDateStr } from './dates'

// Only what Muna needs: read and write events on your own calendar.
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export type GoogleEvent = {
  id: string
  owner_id: string
  owner_name: string
  title: string
  all_day: boolean
  start: string // YYYY-MM-DD (all day) or ISO date-time
  end: string
  link: string | null
}

export type ListResult = { events: GoogleEvent[]; reconnect: string[]; apiDisabled: boolean; failed: boolean }

export async function fetchGoogleEvents(from: Date, to: Date): Promise<ListResult> {
  const { data, error } = await supabase.functions.invoke('google-calendar', {
    body: { action: 'list', from: from.toISOString(), to: to.toISOString() },
  })
  if (error || !data) return { events: [], reconnect: [], apiDisabled: false, failed: true }
  return {
    events: (data.events ?? []) as GoogleEvent[],
    reconnect: (data.reconnect ?? []) as string[],
    apiDisabled: Boolean(data.api_disabled),
    failed: false,
  }
}

// Tasks are mirrored one after another so quick edits never create duplicate events.
let queue: Promise<unknown> = Promise.resolve()

export function syncTasksToGoogle(upsertIds: string[], deletes: { event_id: string; owner: string }[] = []) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const run = async () => {
    const { data } = await supabase.functions.invoke('google-calendar', {
      body: { action: 'sync', upsert_ids: upsertIds, deletes, tz },
    })
    return data as { synced: number; removed: number; reconnect: boolean; api_disabled: boolean } | null
  }
  const next = queue.then(run, run)
  queue = next.catch(() => undefined)
  return next
}

/** Local calendar days (YYYY-MM-DD) an event touches. */
export function eventDays(ev: GoogleEvent): string[] {
  if (ev.all_day) {
    const days: string[] = []
    let d = ev.start
    let guard = 0
    while (d < ev.end && guard < 31) {
      days.push(d)
      d = addDays(d, 1)
      guard++
    }
    return days.length ? days : [ev.start]
  }
  const start = new Date(ev.start)
  const end = new Date(ev.end)
  const first = toDateStr(start)
  // an event that ends exactly at midnight belongs to the previous day
  const last = toDateStr(new Date(end.getTime() - 1))
  const days = [first]
  let d = first
  let guard = 0
  while (d < last && guard < 7) {
    d = addDays(d, 1)
    days.push(d)
    guard++
  }
  return days
}

export function eventTimeLabel(ev: GoogleEvent): string {
  if (ev.all_day) return 'All day'
  const f = (iso: string) => {
    const d = new Date(iso)
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return `${f(ev.start)}–${f(ev.end)}`
}

/** Sort key so all-day events come first, then by start time. */
export function eventSortKey(ev: GoogleEvent): string {
  if (ev.all_day) return '00:00'
  const d = new Date(ev.start)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export { parseDateStr }
