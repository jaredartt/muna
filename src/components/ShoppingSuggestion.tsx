import { useMemo, useState } from 'react'
import { IconCalendarEvent, IconCheck, IconShoppingCart } from '@tabler/icons-react'
import { useShopping, useShoppingPlan } from '../hooks/useShopping'
import { addDays, formatDateNice, todayStr } from '../lib/dates'
import { needNote } from '../lib/meals'
import { useProducts } from '../lib/products'
import { shopsClosed } from '../lib/holidays'

const DISMISS_KEY = 'muna.shopDismiss.v1'
const read = (): string => {
  try {
    return localStorage.getItem(DISMISS_KEY) ?? ''
  } catch {
    return ''
  }
}

/**
 * Muna's suggestion for the next shopping trip: which day, and what goes on it. It is worked out again whenever something changes
 * (a slider moves, a meal is planned, your days fill up), so it always shows the best day right now. Accepting it makes the task.
 */
export default function ShoppingSuggestion() {
  const { trips, load, hasTask, ready } = useShoppingPlan()
  const run = useShopping()
  const products = useProducts()
  const [picked, setPicked] = useState<string | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const [dismissed, setDismissed] = useState(read)

  const trip = trips[0]
  const next = trips[1]
  const nick = useMemo(() => new Map(products.map((p) => [p.id, p.nickname])), [products])
  // "Not now" is remembered for exactly this suggestion; when the day or the things change, it comes back
  const signature = trip ? trip.day + '|' + trip.needs.map((n) => n.product_id).sort().join(',') : ''
  const days = useMemo(() => Array.from({ length: 8 }, (_, i) => addDays(todayStr(), i)), [])

  if (done) {
    return (
      <section className="card shop-sug done" role="status">
        <p>
          <IconCheck size={18} /> {done}
        </p>
      </section>
    )
  }
  if (!ready || hasTask || !trip || dismissed === signature) return null

  const day = picked ?? trip.day
  async function accept() {
    setBusy(true)
    const msg = await run({ create: true, day })
    setBusy(false)
    if (msg) setDone(msg)
  }

  return (
    <section className="card shop-sug">
      <div className="shop-sug-head">
        <IconShoppingCart size={22} />
        <div>
          <h3>Muna suggests a shopping trip</h3>
          <p className="muted small">
            {formatDateNice(day)} · {trip.needs.length} thing{trip.needs.length === 1 ? '' : 's'}. Picked from how fast you use things and how busy your days are.
          </p>
        </div>
      </div>

      {trip.note && picked === null && <p className="shop-sug-note">{trip.note}</p>}

      <ul className="shop-sug-list">
        {trip.needs.map((n) => (
          <li key={n.product_id}>
            <strong>{n.name}</strong>
            {nick.get(n.product_id) && <span className="muted small"> “{nick.get(n.product_id)}”</span>}
            <span className={'ml-chip ' + (n.out || (n.daysLeft != null && n.daysLeft < 2) ? 'miss' : 'ok')}>{needNote(n)}</span>
          </li>
        ))}
      </ul>

      {next && (
        <p className="muted small">
          After that: {formatDateNice(next.day)} for {next.needs.map((n) => n.name).join(', ')}.
        </p>
      )}

      {choosing && (
        <div className="shop-days" role="group" aria-label="Pick another day">
          {days.map((d) => (
            <button
              key={d}
              type="button"
              className={'ml-toggle' + (d === day ? ' on' : '')}
              disabled={Boolean(shopsClosed(d))}
              onClick={() => {
                setPicked(d)
                setChoosing(false)
              }}
              aria-pressed={d === day}
            >
              {formatDateNice(d)}
              <span className="muted small"> {shopsClosed(d) ? `closed · ${shopsClosed(d)}` : load(d) > 2 ? 'busy' : 'free'}</span>
            </button>
          ))}
        </div>
      )}

      <div className="btn-row">
        <button className="btn primary" onClick={() => void accept()} disabled={busy}>
          <IconCheck size={18} /> {busy ? 'Adding…' : 'Add to my tasks'}
        </button>
        <button className="btn soft" onClick={() => setChoosing((c) => !c)}>
          <IconCalendarEvent size={18} /> Another day
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, signature)
            } catch {
              /* fine */
            }
            setDismissed(signature)
          }}
        >
          Not now
        </button>
      </div>
    </section>
  )
}
