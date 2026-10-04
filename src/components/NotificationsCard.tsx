import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { defaultNotify, deviceTz, disablePush, enablePush, loadNotify, pushState, saveNotify, sendTest, type NotifySettings, type PushState } from '../lib/push'

/** Profile: turn reminders on for THIS phone, and choose what you get. */
export default function NotificationsCard() {
  const { profile } = useAuth()
  const [state, setState] = useState<PushState | null>(null)
  const [s, setS] = useState<NotifySettings>(defaultNotify)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const uid = profile?.id ?? ''
  const hid = profile?.household_id ?? ''

  useEffect(() => {
    void pushState().then(setState)
  }, [])
  useEffect(() => {
    if (!uid) return
    void loadNotify(uid).then((r) => {
      if (!r) return
      setS(r)
      if (r.tz !== deviceTz()) void saveNotify(hid, uid, { tz: deviceTz() }) // you travelled: reminders follow the clock of your phone
    })
  }, [uid, hid])

  if (!profile || !state) return null

  async function turnOn() {
    setBusy(true)
    setMsg('')
    const e = await enablePush(hid, uid)
    setBusy(false)
    if (e) setMsg(e)
    else {
      setState('on')
      const r = await loadNotify(uid)
      if (r) setS(r)
    }
  }
  async function turnOff() {
    setBusy(true)
    await disablePush()
    setBusy(false)
    setState(await pushState())
  }
  async function change(patch: Partial<NotifySettings>) {
    setS((x) => ({ ...x, ...patch }))
    const e = await saveNotify(hid, uid, patch)
    if (e) setMsg(e)
  }
  async function test() {
    setBusy(true)
    setMsg('')
    const e = await sendTest()
    setBusy(false)
    setMsg(e ?? 'Sent! It should arrive in a few seconds.')
  }

  return (
    <section className="card">
      <h3>Notifications</h3>
      {state === 'needs-install' && (
        <p className="muted small">
          On iPhone, notifications only work when Muna is opened from the Home Screen. In Safari tap the Share button, then “Add to Home Screen”, and open Muna from that icon. Then come back here.
        </p>
      )}
      {state === 'unsupported' && <p className="muted small">This browser cannot show notifications. On iPhone you need iOS 16.4 or newer, with Muna added to the Home Screen.</p>}
      {state === 'denied' && <p className="muted small">Notifications are blocked for Muna. On iPhone open Settings → Notifications → Muna and allow them, then come back here.</p>}
      {state === 'off' && (
        <>
          <p className="muted small">Get a reminder on this phone for the tasks you choose, and a summary of your day each morning.</p>
          <button className="btn primary" onClick={() => void turnOn()} disabled={busy}>
            Turn on notifications
          </button>
        </>
      )}
      {state === 'on' && (
        <>
          <label className="check-row">
            <input type="checkbox" checked={s.tasks_on} onChange={(e) => void change({ tasks_on: e.target.checked })} />
            <span>Send the reminders I choose on my tasks</span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={s.morning_on} onChange={(e) => void change({ morning_on: e.target.checked })} />
            <span>Morning summary of my day</span>
          </label>
          {s.morning_on && <input type="time" value={s.morning_at} onChange={(e) => e.target.value && void change({ morning_at: e.target.value })} aria-label="Morning summary time" />}
          <p className="muted small">You choose the reminder inside each task (“Remind me”). Only tasks assigned to you (or made by you with nobody else assigned) notify you.</p>
          <div className="course-actions">
            <button className="ml-toggle" onClick={() => void test()} disabled={busy}>
              Send me a test
            </button>
            <button className="ml-toggle" onClick={() => void turnOff()} disabled={busy}>
              Turn off on this phone
            </button>
          </div>
        </>
      )}
      {msg && <p className="muted small">{msg}</p>}
    </section>
  )
}
