// Push notifications for Muna (iPhone: the app must be added to the Home Screen).
//   action "run":  called every minute by the database timer (pg_cron). Sends the task reminders and the morning summary that are due.
//                  Safe to call more often: every notification is written to push_log first, so it is only ever sent once.
//   action "test": a signed-in person gets a test notification on their own devices.
// Secret needed: VAPID_PRIVATE_KEY (the matching public key is VAPID_PUBLIC below and also in the app, src/lib/push.ts).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { addDay, dueNow, type Due, type Settings, type TaskRow } from './pushLogic.ts'

const VAPID_PUBLIC = 'BLQbq2Pg9XXzELxRZFGsnzN31UYr328S-Qn4lEvf7oPu1glU5kKvDGT56cXDUYT38EWwtebOFwqd-516LlT-qmQ'
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:jaredartt@gmail.com'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }

/** Sends one notification to every device of a person. Devices that are gone (404 / 410) are forgotten. Returns how many arrived. */
async function sendToUser(admin: ReturnType<typeof createClient>, subs: Sub[], payload: { title: string; body: string; url: string; tag: string }): Promise<{ sent: number; errors: string[] }> {
  let sent = 0
  const errors: string[] = []
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: 'high' })
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
      else errors.push(`${code ?? ''} ${(e as Error).message}`.trim().slice(0, 160))
    }
  }
  return { sent, errors }
}

async function run(admin: ReturnType<typeof createClient>): Promise<Record<string, unknown>> {
  const now = new Date()
  const { data: settings } = await admin.from('notify_settings').select('user_id, household_id, tz, tasks_on, morning_on, morning_at').or('tasks_on.eq.true,morning_on.eq.true')
  const people = (settings ?? []) as (Settings & { household_id: string })[]
  if (!people.length) return { users: 0 }
  const { data: subRows } = await admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').in('user_id', people.map((p) => p.user_id))
  const subs = (subRows ?? []) as Sub[]
  const withDevice = people.filter((p) => subs.some((s) => s.user_id === p.user_id))
  if (!withDevice.length) return { users: 0 }

  const today = now.toISOString().slice(0, 10)
  const from = addDay(today, -2)
  const to = addDay(today, 3)
  const hids = [...new Set(withDevice.map((p) => p.household_id))]
  const { data: taskRows } = await admin
    .from('tasks')
    .select('id, household_id, title, assigned_to, created_by, due_date, start_time, remind_minutes, completed, repeat')
    .in('household_id', hids)
    .eq('completed', false)
    .or(`repeat.not.is.null,and(due_date.gte.${from},due_date.lte.${to})`)
  const tasks = (taskRows ?? []) as (TaskRow & { household_id: string })[]
  const { data: doneRows } = await admin.from('task_completions').select('task_id, occ_date').in('household_id', hids).gte('occ_date', from).lte('occ_date', to)
  const done = new Set((doneRows ?? []).map((d: { task_id: string; occ_date: string }) => `${d.task_id}|${d.occ_date}`))

  let sent = 0
  const errors: string[] = []
  for (const p of withDevice) {
    const due: Due[] = dueNow(p, tasks.filter((t) => t.household_id === p.household_id), done, now)
    if (!due.length) continue
    // write to the log first: only what is NEW there is sent (a second call in the same minute finds it already logged)
    const { data: fresh } = await admin
      .from('push_log')
      .upsert(due.map((d) => ({ user_id: p.user_id, kind: d.kind, ref: d.ref, day: d.day })), { onConflict: 'user_id,kind,ref,day', ignoreDuplicates: true })
      .select('kind, ref, day')
    const isNew = new Set((fresh ?? []).map((r: { kind: string; ref: string; day: string }) => `${r.kind}|${r.ref}|${r.day}`))
    for (const d of due.filter((x) => isNew.has(`${x.kind}|${x.ref}|${x.day}`))) {
      const r = await sendToUser(admin, subs.filter((s) => s.user_id === p.user_id), { title: d.title, body: d.body, url: d.url, tag: d.tag })
      sent += r.sent
      errors.push(...r.errors)
    }
  }
  await admin.from('push_log').delete().lt('sent_at', new Date(Date.now() - 7 * 86400000).toISOString())
  return { users: withDevice.length, sent, errors }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!VAPID_PRIVATE) return json({ error: 'The notification key is not set up yet (VAPID_PRIVATE_KEY).' }, 503)
  webpush.setVapidDetails(SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

  let body: { action?: unknown }
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  if (body.action === 'run') return json(await run(admin))

  if (body.action === 'test') {
    const authHeader = req.headers.get('Authorization') ?? ''
    const { data: u, error } = await admin.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''))
    if (error || !u.user) return json({ error: 'Please sign in again.' }, 401)
    const { data: subRows } = await admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').eq('user_id', u.user.id)
    const subs = (subRows ?? []) as Sub[]
    if (!subs.length) return json({ error: 'No phone is registered yet. Turn notifications on first.' }, 404)
    const r = await sendToUser(admin, subs, { title: 'Muna', body: 'Notifications work! I will remind you of your tasks.', url: './#/profile', tag: 'test' })
    if (!r.sent) return json({ error: 'Could not reach your phone: ' + (r.errors[0] ?? 'it may have been removed. Turn notifications off and on again.') }, 502)
    return json({ sent: r.sent })
  }
  return json({ error: 'Unknown action' }, 400)
})
