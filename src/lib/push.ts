// Push notifications on this phone: ask permission, register the phone with the server, and the person's notification settings.
// iPhone: it only works when Muna was added to the Home Screen and is opened from there (iOS 16.4 or newer).
import { supabase } from './supabase'

// The public half of the server's key pair (the private half is a secret of the muna-push edge function). Keep in sync with muna-push/index.ts.
export const VAPID_PUBLIC = 'BLQbq2Pg9XXzELxRZFGsnzN31UYr328S-Qn4lEvf7oPu1glU5kKvDGT56cXDUYT38EWwtebOFwqd-516LlT-qmQ'

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

export type NotifySettings = { tz: string; tasks_on: boolean; lead_minutes: number; morning_on: boolean; morning_at: string }
export const defaultNotify = (): NotifySettings => ({ tz: deviceTz(), tasks_on: true, lead_minutes: 15, morning_on: true, morning_at: '08:00' })
export const deviceTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin'

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isInstalled = () => (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches
const canPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing) return existing
  await navigator.serviceWorker.register('./sw.js')
  return navigator.serviceWorker.ready
}

/** What the notification switch of this phone looks like right now. */
export async function pushState(): Promise<PushState> {
  if (!canPush()) return isIOS() && !isInstalled() ? 'needs-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    return sub && Notification.permission === 'granted' ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

/** Asks permission (must be called from a tap), registers this phone and saves it. Returns an error text or null. */
export async function enablePush(householdId: string, userId: string): Promise<string | null> {
  if (!canPush()) return 'This phone or browser cannot show notifications.'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'Notifications were not allowed. On iPhone: Settings → Notifications → Muna.'
  try {
    const reg = await registration()
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }))
    const j = sub.toJSON()
    if (!j.endpoint || !j.keys?.p256dh || !j.keys.auth) return 'Could not register this phone. Try again.'
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ user_id: userId, household_id: householdId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, device: navigator.userAgent.slice(0, 120) }, { onConflict: 'endpoint' })
    if (error) return error.message
    // make sure the person has settings (and the right time zone) without changing choices they already made
    await supabase.from('notify_settings').upsert({ user_id: userId, household_id: householdId, tz: deviceTz() }, { onConflict: 'user_id' })
    return null
  } catch (e) {
    return e instanceof Error ? e.message : 'Could not turn notifications on.'
  }
}

export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
  } catch {
    /* fine */
  }
}

export async function loadNotify(userId: string): Promise<NotifySettings | null> {
  const { data } = await supabase.from('notify_settings').select('tz, tasks_on, lead_minutes, morning_on, morning_at').eq('user_id', userId).maybeSingle()
  return (data as NotifySettings | null) ?? null
}
export async function saveNotify(householdId: string, userId: string, patch: Partial<NotifySettings>): Promise<string | null> {
  const { error } = await supabase.from('notify_settings').upsert({ user_id: userId, household_id: householdId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  return error?.message ?? null
}

/** Sends a test notification to this person's phones. Returns an error text or null. */
export async function sendTest(): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('muna-push', { body: { action: 'test' } })
  if (error) {
    const ctx = (error as { context?: Response }).context
    try {
      const j = ctx && typeof ctx.json === 'function' ? await ctx.json() : null
      if (j?.error) return String(j.error)
    } catch {
      /* fall through */
    }
    return 'Could not send the test. Try again in a moment.'
  }
  return data?.sent ? null : 'Nothing was sent.'
}
