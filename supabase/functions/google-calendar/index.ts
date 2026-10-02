// Google Calendar bridge for Muna.
//   action "list": events from every connected person in the home (primary calendars), for a date range.
//   action "sync": mirror Muna tasks into the right person's Google Calendar (create / update / delete).
//   action "update_event" / "delete_event": edit or remove any event on either person's calendar (both can edit each other's).
// Google refresh tokens live in table google_connections, which only this server code (service role) can read.
// Secrets needed: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (same OAuth client you created for Google login).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { addDaysStr, isExcluded, lastOccurrence, matchesPattern, type Repeat } from './recurrence.ts'

const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type Task = {
  id: string
  household_id: string
  created_by: string
  assigned_to: string | null
  title: string
  notes: string
  due_date: string | null
  start_time: string | null
  end_time: string | null
  completed: boolean
  sync_google: boolean
  google_event_id: string | null
  google_owner: string | null
  repeat: Repeat | null
}

class GoogleError extends Error {
  constructor(public code: 'reconnect' | 'api_disabled' | 'other', message: string) {
    super(message)
  }
}

// ---------- tokens ----------
const tokenCache = new Map<string, string>()

async function accessTokenFor(admin: SupabaseClient, userId: string): Promise<string | null> {
  const cached = tokenCache.get(userId)
  if (cached) return cached
  const { data } = await admin.from('google_connections').select('refresh_token').eq('user_id', userId).maybeSingle()
  if (!data) return null
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: data.refresh_token as string,
      grant_type: 'refresh_token',
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.access_token) {
    console.error('token refresh failed', res.status, body?.error)
    if (body?.error === 'invalid_grant') {
      await admin.from('google_connections').delete().eq('user_id', userId)
      throw new GoogleError('reconnect', 'Google access expired. Please reconnect.')
    }
    throw new GoogleError('other', 'Could not talk to Google.')
  }
  tokenCache.set(userId, body.access_token)
  return body.access_token as string
}

async function gcal(token: string, method: string, path: string, body?: unknown): Promise<{ status: number; data: any }> {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    /* ignore */
  }
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const reason = data?.error?.errors?.[0]?.reason ?? data?.error?.status ?? ''
    console.error('google api error', method, res.status, reason)
    if (res.status === 401) throw new GoogleError('reconnect', 'Google access expired. Please reconnect.')
    if (reason === 'accessNotConfigured' || reason === 'SERVICE_DISABLED') {
      throw new GoogleError('api_disabled', 'The Google Calendar API is not enabled in Google Cloud yet.')
    }
    if (res.status === 403) throw new GoogleError('reconnect', 'Muna needs permission to use your calendar. Please reconnect.')
    throw new GoogleError('other', 'Google Calendar returned an error.')
  }
  return { status: res.status, data }
}

// ---------- helpers ----------
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
function addDay(d: string): string {
  const t = new Date(Date.parse(d + 'T00:00:00Z') + 86400000)
  return t.toISOString().slice(0, 10)
}
function hhmm(t: string): string {
  return t.slice(0, 5)
}
function endTimeFor(start: string, end: string | null): { date?: string; time: string } {
  if (end) return { time: hhmm(end) }
  const [h, m] = hhmm(start).split(':').map(Number)
  const total = h * 60 + m + 60
  if (total >= 24 * 60) return { time: '23:59' }
  return { time: `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` }
}

const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
const compact = (d: string) => d.replaceAll('-', '')

// local date+time in a time zone -> UTC stamp like 20261231T213000Z
function utcStamp(date: string, time: string, tz: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
  const p = Object.fromEntries(f.formatToParts(new Date(guess)).map((x) => [x.type, Number(x.value)]))
  const asLocal = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  return new Date(guess - (asLocal - guess)).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
}

// Muna repeat rule -> Google "RRULE" (+ EXDATE lines for the days it skips)
function recurrenceLines(t: Task, tz: string): string[] {
  const r = t.repeat!
  const start = t.due_date!
  const every = Math.max(1, r.every || 1)
  const timed = Boolean(t.start_time)
  const wd = (new Date(Date.parse(start + 'T00:00:00Z')).getUTCDay() + 6) % 7
  const parts: string[] = []
  if (r.freq === 'day') parts.push('FREQ=DAILY')
  if (r.freq === 'week') parts.push('FREQ=WEEKLY', 'BYDAY=' + (r.weekdays?.length ? r.weekdays : [wd]).map((d) => BYDAY[d]).join(','))
  if (r.freq === 'month') {
    parts.push('FREQ=MONTHLY')
    if (r.nth) parts.push(`BYDAY=${r.nth.n}${BYDAY[r.nth.weekday]}`)
    else parts.push('BYMONTHDAY=' + (r.monthDays?.length ? r.monthDays : [Number(start.slice(8, 10))]).join(','))
  }
  if (r.freq === 'year') parts.push('FREQ=YEARLY')
  parts.push(`INTERVAL=${every}`)
  const last = lastOccurrence(start, r) // a "stop after N times" rule is turned into its last day, so skipped days do not count
  if (last) parts.push('UNTIL=' + (timed ? utcStamp(last, hhmm(t.start_time!), tz) : compact(last)))
  const lines = ['RRULE:' + parts.join(';')]
  if (r.exceptWeekdays?.length || r.exceptWeeks?.length) {
    const stop = last && last < addDaysStr(start, 730) ? last : addDaysStr(start, 730)
    let n = 0
    for (let d = start; d <= stop && n < 150; d = addDaysStr(d, 1)) {
      if (matchesPattern(r, start, d) && isExcluded(r, d)) {
        lines.push(timed ? `EXDATE;TZID=${tz}:${compact(d)}T${hhmm(t.start_time!).replace(':', '')}00` : `EXDATE;VALUE=DATE:${compact(d)}`)
        n++
      }
    }
  }
  return lines
}

function eventBody(t: Task, tz: string, patch = false) {
  const summary = (t.completed && !t.repeat ? '✓ ' : '') + t.title
  const base = {
    summary,
    description: t.notes ? t.notes + '\n\n(Added from Muna)' : '(Added from Muna)',
    extendedProperties: { private: { muna_task_id: t.id } },
    ...(t.repeat ? { recurrence: recurrenceLines(t, tz) } : patch ? { recurrence: null } : {}),
  }
  if (t.start_time) {
    const end = endTimeFor(t.start_time, t.end_time)
    return {
      ...base,
      start: { dateTime: `${t.due_date}T${hhmm(t.start_time)}:00`, timeZone: tz, ...(patch ? { date: null } : {}) },
      end: { dateTime: `${t.due_date}T${end.time}:00`, timeZone: tz, ...(patch ? { date: null } : {}) },
    }
  }
  // all-day: when updating an event that used to be timed, clear the old time fields explicitly
  const clear = patch ? { dateTime: null, timeZone: null } : {}
  return { ...base, start: { date: t.due_date, ...clear }, end: { date: addDay(t.due_date!), ...clear } }
}

function validTz(tz: unknown): string {
  if (typeof tz === 'string') {
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz })
      return tz
    } catch {
      /* fall through */
    }
  }
  return 'Europe/Berlin'
}

// ---------- handler ----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: 'not_configured', message: 'Google Calendar is not set up yet (missing Google secrets).' }, 500)

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const url = Deno.env.get('SUPABASE_URL')!
  const userDb = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  const { data: u, error: uErr } = await userDb.auth.getUser(token)
  if (uErr || !u.user) return json({ error: 'Please sign in again.' }, 401)
  const me = u.user.id

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }

  const { data: myProfile } = await admin.from('profiles').select('household_id').eq('id', me).single()
  if (!myProfile) return json({ error: 'Profile not found' }, 404)
  const householdId = myProfile.household_id as string
  const { data: members } = await admin.from('profiles').select('id, display_name').eq('household_id', householdId)
  const memberIds = new Set((members ?? []).map((m) => m.id as string))
  const { data: conns } = await admin.from('google_connections').select('user_id').in('user_id', [...memberIds])
  const connected = new Set((conns ?? []).map((c) => c.user_id as string))

  try {
    // ---------------- LIST ----------------
    if (body.action === 'list') {
      const from = new Date(String(body.from))
      const to = new Date(String(body.to))
      if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from || to.getTime() - from.getTime() > 70 * 86400000) {
        return json({ error: 'Bad date range' }, 400)
      }
      const events: unknown[] = []
      const reconnect: string[] = []
      let apiDisabled = false
      for (const m of members ?? []) {
        const uid = m.id as string
        if (!connected.has(uid)) continue
        try {
          const at = await accessTokenFor(admin, uid)
          if (!at) continue
          const q = new URLSearchParams({
            timeMin: from.toISOString(),
            timeMax: to.toISOString(),
            singleEvents: 'true',
            orderBy: 'startTime',
            maxResults: '250',
          })
          const { data } = await gcal(at, 'GET', '?' + q.toString())
          for (const ev of data?.items ?? []) {
            if (ev.status === 'cancelled') continue
            if (ev.extendedProperties?.private?.muna_task_id) continue // already shown as a Muna task
            events.push({
              id: `${uid}:${ev.id}`,
              event_id: ev.id,
              recurring: Boolean(ev.recurringEventId),
              owner_id: uid,
              owner_name: m.display_name,
              title: ev.summary ?? '(no title)',
              all_day: Boolean(ev.start?.date),
              start: ev.start?.dateTime ?? ev.start?.date,
              end: ev.end?.dateTime ?? ev.end?.date,
              link: ev.htmlLink ?? null,
              notes: String(ev.description ?? '').replace(/\n*\(Added from Muna\)\s*$/, '').slice(0, 2000),
            })
          }
        } catch (e) {
          if (e instanceof GoogleError && e.code === 'reconnect') reconnect.push(uid)
          else if (e instanceof GoogleError && e.code === 'api_disabled') apiDisabled = true
          else console.error('list failed for', uid, e)
        }
      }
      return json({ events, reconnect, api_disabled: apiDisabled })
    }

    // ---------------- SYNC ----------------
    if (body.action === 'sync') {
      const tz = validTz(body.tz)
      const ids: string[] = (Array.isArray(body.upsert_ids) ? body.upsert_ids : []).filter((i: unknown) => typeof i === 'string').slice(0, 25)
      const deletes: { event_id: string; owner: string }[] = (Array.isArray(body.deletes) ? body.deletes : [])
        .filter((d: any) => d && typeof d.event_id === 'string' && typeof d.owner === 'string')
        .slice(0, 25)
      const result = { synced: 0, removed: 0, skipped: 0, errors: [] as string[], reconnect: false, api_disabled: false }

      const deleteEvent = async (owner: string, eventId: string) => {
        if (!memberIds.has(owner)) return
        const at = await accessTokenFor(admin, owner)
        if (!at) return
        await gcal(at, 'DELETE', `/${encodeURIComponent(eventId)}`)
        result.removed++
      }

      for (const d of deletes) {
        try {
          await deleteEvent(d.owner, d.event_id)
        } catch (e) {
          if (e instanceof GoogleError) {
            result.errors.push(e.message)
            if (e.code === 'reconnect') result.reconnect = true
            if (e.code === 'api_disabled') result.api_disabled = true
          }
        }
      }

      if (ids.length) {
        const { data: tasks } = await admin
          .from('tasks')
          .select('id, household_id, created_by, assigned_to, title, notes, due_date, start_time, end_time, completed, sync_google, google_event_id, google_owner, repeat')
          .in('id', ids)
          .eq('household_id', householdId)
        for (const t of (tasks ?? []) as Task[]) {
          try {
            // Whose calendar? The assigned person's, else the creator's; fall back to the person acting now.
            let owner: string | null = t.assigned_to ?? t.created_by
            if (!owner || !connected.has(owner)) owner = connected.has(me) ? me : null
            const wants = Boolean(t.sync_google && t.due_date && DATE_RE.test(t.due_date) && owner)

            if (t.google_event_id && t.google_owner && (!wants || owner !== t.google_owner)) {
              await deleteEvent(t.google_owner, t.google_event_id)
              await admin.from('tasks').update({ google_event_id: null, google_owner: null }).eq('id', t.id)
              t.google_event_id = null
              t.google_owner = null
            }
            if (!wants || !owner) {
              result.skipped++
              continue
            }
            const at = await accessTokenFor(admin, owner)
            if (!at) {
              result.skipped++
              continue
            }
            let eventId = t.google_event_id
            if (eventId) {
              const r = await gcal(at, 'PATCH', `/${encodeURIComponent(eventId)}`, eventBody(t, tz, true))
              if (r.status === 404 || r.status === 410) eventId = null
            }
            if (!eventId) {
              const r = await gcal(at, 'POST', '', eventBody(t, tz))
              eventId = r.data?.id ?? null
            }
            if (eventId && (eventId !== t.google_event_id || owner !== t.google_owner)) {
              await admin.from('tasks').update({ google_event_id: eventId, google_owner: owner }).eq('id', t.id)
            }
            result.synced++
          } catch (e) {
            if (e instanceof GoogleError) {
              result.errors.push(e.message)
              if (e.code === 'reconnect') result.reconnect = true
              if (e.code === 'api_disabled') result.api_disabled = true
            } else {
              console.error('sync failed', t.id, e)
              result.errors.push('Something went wrong while syncing.')
            }
          }
        }
      }
      return json(result)
    }

    // ---------------- UPDATE / DELETE ONE EVENT ----------------
    if (body.action === 'update_event' || body.action === 'delete_event') {
      const owner = typeof body.owner_id === 'string' ? body.owner_id : ''
      const eventId = typeof body.event_id === 'string' ? body.event_id : ''
      if (!eventId || !memberIds.has(owner) || !connected.has(owner)) return json({ ok: false, error: 'not_found', message: 'That event could not be found.' })
      const at = await accessTokenFor(admin, owner)
      if (!at) return json({ ok: false, reconnect: true, message: 'Google access expired. Please reconnect.' })
      const path = `/${encodeURIComponent(eventId)}`
      try {
        if (body.action === 'delete_event') {
          // scope "all" on a repeating event removes the whole series; anything else removes just that one day
          let delPath = path
          if (body.scope === 'all') {
            const one = await gcal(at, 'GET', path)
            if (one.data?.recurringEventId) delPath = `/${encodeURIComponent(one.data.recurringEventId)}`
          }
          await gcal(at, 'DELETE', delPath)
          return json({ ok: true })
        }
        const tz = validTz(body.tz)
        const cur = await gcal(at, 'GET', `${path}?timeZone=${encodeURIComponent(tz)}`)
        let ex = cur.data
        if (!ex || cur.status === 404 || cur.status === 410 || ex.status === 'cancelled') return json({ ok: false, error: 'not_found', message: 'That event no longer exists.' })
        // A repeating event is changed everywhere by default (scope "all"): edit the series itself, not just this one day.
        let evPath = path
        let series = false
        if (ex.recurringEventId && body.scope !== 'one') {
          const m = await gcal(at, 'GET', `/${encodeURIComponent(ex.recurringEventId)}?timeZone=${encodeURIComponent(tz)}`)
          if (m.data && m.status < 400 && m.data.status !== 'cancelled' && m.data.start) {
            ex = m.data
            evPath = `/${encodeURIComponent(ex.id)}`
            series = true
          }
        }
        if (ex.extendedProperties?.private?.muna_task_id) return json({ ok: false, error: 'muna_task', message: 'That is a Muna task. Edit it as a task.' })

        const wasAllDay = Boolean(ex.start?.date)
        const allDay = typeof body.all_day === 'boolean' ? body.all_day : wasAllDay
        const exStartDate: string = wasAllDay ? ex.start.date : String(ex.start.dateTime).slice(0, 10)
        const exEndDate: string = wasAllDay ? addDaysStr(ex.end.date, -1) : String(ex.end.dateTime).slice(0, 10)
        const exStartTime: string | null = wasAllDay ? null : String(ex.start.dateTime).slice(11, 16)
        const exEndTime: string | null = wasAllDay ? null : String(ex.end.dateTime).slice(11, 16)
        const span = Math.max(0, Math.round((Date.parse(exEndDate + 'T00:00:00Z') - Date.parse(exStartDate + 'T00:00:00Z')) / 86400000))

        // for a whole series the days come from the series (the repeat rule decides them); only title and times change
        const date = !series && typeof body.date === 'string' ? body.date : exStartDate
        if (!DATE_RE.test(date)) return json({ ok: false, error: 'bad_date', message: 'The date looks wrong.' })
        let endDate = series ? exEndDate : typeof body.end_date === 'string' ? body.end_date : body.date ? addDaysStr(date, span) : exEndDate
        if (!DATE_RE.test(endDate) || endDate < date) endDate = date

        const patch: Record<string, unknown> = {}
        if (typeof body.title === 'string') {
          const t = body.title.trim().slice(0, 300)
          if (!t) return json({ ok: false, error: 'bad_title', message: 'The title cannot be empty.' })
          patch.summary = t
        }
        if (typeof body.notes === 'string') patch.description = body.notes.slice(0, 2000)
        if (allDay) {
          patch.start = { date, dateTime: null, timeZone: null }
          patch.end = { date: addDaysStr(endDate, 1), dateTime: null, timeZone: null }
        } else {
          const st = typeof body.start_time === 'string' && /^\d{2}:\d{2}/.test(body.start_time) ? hhmm(body.start_time) : (exStartTime ?? '09:00')
          let et = typeof body.end_time === 'string' && /^\d{2}:\d{2}/.test(body.end_time) ? hhmm(body.end_time) : (typeof body.start_time === 'string' || !exEndTime ? endTimeFor(st, null).time : exEndTime)
          if (endDate === date && et <= st) et = endTimeFor(st, null).time
          patch.start = { dateTime: `${date}T${st}:00`, timeZone: tz, date: null }
          patch.end = { dateTime: `${endDate}T${et}:00`, timeZone: tz, date: null }
        }
        const r = await gcal(at, 'PATCH', evPath, patch)
        if (r.status === 404 || r.status === 410) return json({ ok: false, error: 'not_found', message: 'That event no longer exists.' })
        return json({ ok: true })
      } catch (e) {
        if (e instanceof GoogleError) return json({ ok: false, reconnect: e.code === 'reconnect', api_disabled: e.code === 'api_disabled', message: e.message })
        throw e
      }
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    console.error('google-calendar failed', e)
    return json({ error: 'Something went wrong.' }, 500)
  }
})
