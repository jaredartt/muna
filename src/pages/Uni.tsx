import { useEffect, useMemo, useRef, useState } from 'react'
import { IconCheck, IconChevronDown, IconChevronLeft, IconPlus, IconSparkles, IconTrashFilled, IconX } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import { useTasksCtx } from '../context/TasksContext'
import { useGoogleEvents } from '../hooks/useGoogleEvents'
import { useSheetScrollGuard } from '../hooks/useSheetScrollGuard'
import { addDays, parseDateStr, todayStr } from '../lib/dates'
import { navigate } from '../lib/router'
import { addUniItem, commitPlan, currentWeekOf, deleteUniItem, duration, fmtMin, itemState, setCurrentWeek, unplanItem, updateUniItem, useUniItems, useUniSettings, weekProgress, type UniItem } from '../lib/uni'
import { daysBetween, planStudy, type Span } from '../lib/uniPlan'

const niceDay = (d: string) => parseDateStr(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const clock = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const hoursText = (min: number) => String(Math.round((min / 60) * 100) / 100)

export default function Uni() {
  const { session, profile } = useAuth()
  const { tasks } = useTasksCtx()
  const uid = session?.user.id ?? ''
  const all = useUniItems()
  const items = useMemo(() => all.filter((i) => i.created_by === uid), [all, uid])
  const setting = useUniSettings().find((s) => s.user_id === uid)
  const today = todayStr()
  const current = currentWeekOf(items, tasks, setting, today)
  const weeks = useMemo(() => [...new Set([...items.map((i) => i.week), ...(current ? [current] : [])])].sort((a, b) => a - b), [items, current])
  const [week, setWeek] = useState<number | null>(null)
  const shown = week ?? current ?? 1
  const list = items.filter((i) => i.week === shown)
  const prog = weekProgress(items, tasks, shown, today)
  const [planning, setPlanning] = useState(false)
  const [weekText, setWeekText] = useState(String(shown))
  useEffect(() => setWeekText(String(shown)), [shown])
  function typeWeek(v: string) {
    setWeekText(v.replace(/\D/g, '').slice(0, 2))
    const n = Number(v)
    if (Number.isInteger(n) && n >= 1 && n <= 99) setWeek(n)
  }

  // add form
  const [title, setTitle] = useState('')
  const [hours, setHours] = useState('1')
  const [err, setErr] = useState('')
  async function add() {
    const m = Math.round(Number(hours.replace(',', '.')) * 60)
    if (!profile || !title.trim()) return
    if (!(m >= 5)) return setErr('How long do you plan to spend? For example 1.5 (hours).')
    setErr('')
    const e = await addUniItem(profile.household_id, uid, shown, title, Math.min(2400, Math.round(m / 5) * 5))
    if (e) setErr(e)
    else {
      setTitle('')
      if (!setting && current === null) void setCurrentWeek(profile.household_id, uid, shown) // the first week you fill in is your current week
    }
  }

  if (!profile) return null
  const needPlan = list.filter((i) => !itemState(i, tasks, today).done && !itemState(i, tasks, today).planned)
  const maxWeek = weeks.length ? Math.max(...weeks) : 0

  return (
    <div className="page">
      <header className="page-head">
        <div className="updates-title">
          <button className="icon-btn" onClick={() => navigate('/')} aria-label="Back to Home">
            <IconChevronLeft size={24} />
          </button>
          <h1>Uni</h1>
        </div>
      </header>

      <section className="card">
        <div className="ml-slotline" role="tablist" aria-label="Uni weeks">
          {weeks.map((w) => (
            <button key={w} className={'ml-toggle' + (w === shown ? ' on' : '')} onClick={() => setWeek(w)} aria-pressed={w === shown}>
              Week {w}
              {w === current ? ' ·  now' : ''}
            </button>
          ))}
          {maxWeek < 99 && (
            <button className="ml-toggle" onClick={() => setWeek(maxWeek + 1)} aria-label="Add a new week">
              <IconPlus size={14} /> New week
            </button>
          )}
        </div>
        <label className="uni-weekno">
          <span>Which week are you in? Type the number</span>
          <input type="number" inputMode="numeric" min="1" max="99" value={weekText} onChange={(e) => typeWeek(e.target.value)} onBlur={() => setWeekText(String(shown))} aria-label="Week number" />
        </label>
        <div className="uni-sum">
          <strong>Week {shown}</strong>
          <span className="muted small">
            {prog.total ? `${duration(prog.done)} done of ${duration(prog.total)} planned` : 'Nothing added yet'}
          </span>
          {shown !== current && (
            <button className="ml-toggle" onClick={() => void setCurrentWeek(profile.household_id, uid, shown)}>
              Make this my current week
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <h3>Add an assignment or reading</h3>
        <div className="uni-add">
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void add()} placeholder="e.g. Read chapter 4" aria-label="What is it?" />
          <label className="uni-hours">
            <input type="text" inputMode="decimal" autoComplete="off" value={hours} onChange={(e) => setHours(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 5))} aria-label="Hours you plan to spend" />
            <span>h</span>
          </label>
          <button className="btn primary" onClick={() => void add()} disabled={!title.trim()} aria-label="Add">
            <IconPlus size={20} />
          </button>
        </div>
        <p className="muted small">How many hours you plan to spend on it (1.5 = an hour and a half).</p>
        {err && <p className="error">{err}</p>}
      </section>

      <section className="card">
        <h3>Week {shown}</h3>
        {list.length === 0 && <p className="muted small">Add what you have to do this week, then let Muna find the time for it.</p>}
        {list.map((i) => (
          <Row key={i.id} item={i} today={today} />
        ))}
        {list.length > 0 && (
          <button className="btn primary" onClick={() => setPlanning(true)}>
            <IconSparkles size={20} /> {needPlan.length ? `Plan ${needPlan.length} item${needPlan.length === 1 ? '' : 's'} with Muna` : 'Plan with Muna'}
          </button>
        )}
      </section>

      {planning && <PlanSheet weeks={weeks} startWeek={shown} items={items} onClose={() => setPlanning(false)} />}
    </div>
  )
}

function Row({ item, today }: { item: UniItem; today: string }) {
  const { tasks, toggleTask, deleteTask } = useTasksCtx()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [hours, setHours] = useState(hoursText(item.minutes))
  const [wk, setWk] = useState(String(item.week))
  useEffect(() => {
    setTitle(item.title)
    setHours(hoursText(item.minutes))
    setWk(String(item.week))
  }, [item.title, item.minutes, item.week])
  const st = itemState(item, tasks, today)
  const first = st.upcoming[0]
  const status = st.done
    ? 'Done'
    : st.planned
      ? `Planned: ${st.upcoming.length > 1 ? `${st.upcoming.length} blocks, from ` : ''}${niceDay(first.due_date ?? today)} ${first.start_time?.slice(0, 5) ?? ''}`
      : st.linked.some((t) => !t.completed)
        ? 'Missed, plan it again'
        : 'Not planned yet'

  async function tick() {
    if (st.done) {
      await updateUniItem(item.id, { done: false })
      return
    }
    await updateUniItem(item.id, { done: true })
    for (const t of st.linked) if (!t.completed) void toggleTask(t)
  }
  function saveTitle() {
    const t = title.trim()
    if (t && t !== item.title) void updateUniItem(item.id, { title: t })
    else setTitle(item.title)
  }
  function saveHours() {
    const m = Math.round(Number(hours.replace(',', '.')) * 60)
    if (m >= 5 && Math.round(m / 5) * 5 !== item.minutes) void updateUniItem(item.id, { minutes: Math.min(2400, Math.round(m / 5) * 5) })
    else setHours(hoursText(item.minutes))
  }

  function saveWeek() {
    const n = Number(wk)
    if (Number.isInteger(n) && n >= 1 && n <= 99 && n !== item.week) void updateUniItem(item.id, { week: n })
    else setWk(String(item.week))
  }

  return (
    <div className={'uni-item' + (st.done ? ' done' : '')}>
      <div className="uni-top">
        <button type="button" className={'check' + (st.done ? ' checked' : '')} onClick={() => void tick()} aria-label={st.done ? 'Mark as not done' : 'Mark as done'} aria-pressed={st.done}>
          {st.done && <IconCheck size={16} stroke={3} />}
        </button>
        <button type="button" className="uni-name" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <strong>
            {item.title} <IconChevronDown size={16} className={'pt-chev' + (open ? ' open' : '')} />
          </strong>
          <span className="muted small">
            {duration(item.minutes)} · {status}
          </span>
        </button>
      </div>
      {open && (
        <div className="uni-edit">
          <div className="uni-add">
            <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} aria-label="Name" />
            <label className="uni-hours">
              <input type="text" inputMode="decimal" autoComplete="off" value={hours} onChange={(e) => setHours(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 5))} onBlur={saveHours} aria-label="Hours" />
              <span>h</span>
            </label>
          </div>
          <label className="uni-weekno">
            <span>Week</span>
            <input type="number" inputMode="numeric" min="1" max="99" value={wk} onChange={(e) => setWk(e.target.value.replace(/\D/g, '').slice(0, 2))} onBlur={saveWeek} aria-label="Week of this item" />
          </label>
          {st.linked.some((t) => !t.completed) && (
            <button
              type="button"
              className="ml-toggle"
              onClick={async () => {
                await unplanItem(item, { tasks, deleteTask }, today)
              }}
            >
              Take it off my calendar
            </button>
          )}
          {!confirm ? (
            <button type="button" className="ml-toggle" onClick={() => setConfirm(true)}>
              <IconTrashFilled size={14} /> Delete
            </button>
          ) : (
            <div className="pt-confirm" role="alertdialog">
              <span>
                Delete <strong>{item.title}</strong>
                {st.linked.some((t) => !t.completed) ? ' and its blocks in your calendar' : ''}?
              </span>
              <span className="pt-confirm-btns">
                <button type="button" className="ml-toggle" onClick={() => setConfirm(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="ml-toggle danger"
                  onClick={async () => {
                    await unplanItem(item, { tasks, deleteTask }, today)
                    await deleteUniItem(item.id)
                  }}
                >
                  Delete
                </button>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const KEY = 'muna.uniPlan.v1'
type Saved = { winStart: string; winEnd: string }
function loadSaved(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null
    if (s?.winStart && s.winEnd) return s
  } catch {
    /* fine */
  }
  return { winStart: '09:00', winEnd: '20:00' }
}

/** Choose weeks, the days you want to study on and the hours. Muna shows the plan, you add it to your calendar. */
function PlanSheet({ weeks, startWeek, items, onClose }: { weeks: number[]; startWeek: number; items: UniItem[]; onClose: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null)
  useSheetScrollGuard(backdropRef)
  const { session, profile, googleConnected } = useAuth()
  const { tasks, occurrenceMap, deleteTask } = useTasksCtx()
  const uid = session?.user.id ?? ''
  const today = todayStr()
  const saved = useMemo(loadSaved, [])
  const [picked, setPicked] = useState<number[]>([startWeek])
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(() => {
    const wd = parseDateStr(today).getDay() // 0 = Sunday
    return addDays(today, wd === 0 ? 0 : 7 - wd)
  })
  const [winStart, setWinStart] = useState(saved.winStart)
  const [winEnd, setWinEnd] = useState(saved.winEnd)
  const [replan, setReplan] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const mine = items.filter((i) => picked.includes(i.week))
  const states = mine.map((i) => ({ item: i, st: itemState(i, tasks, today) }))
  const alreadyPlanned = states.filter((x) => !x.st.done && x.st.planned)
  const toPlan = states.filter((x) => !x.st.done && (!x.st.planned || replan))

  // what is already in your days: your tasks with times and your Google events (all-day ones do not block)
  const dayList = useMemo(() => (from <= to ? daysBetween(from, to) : []), [from, to])
  const gFrom = useMemo(() => parseDateStr(addDays(from, -1)), [from])
  const gTo = useMemo(() => parseDateStr(addDays(to < from ? from : to, 2)), [from, to])
  const google = useGoogleEvents(gFrom, gTo)
  const replanIds = useMemo(() => new Set(replan ? alreadyPlanned.flatMap((x) => x.st.upcoming.map((t) => t.id)) : []), [replan, alreadyPlanned])
  const busy_ = useMemo(() => {
    const map = new Map<string, Span[]>()
    const days = from <= to ? occurrenceMap(from, to) : new Map()
    for (const d of dayList) {
      const spans: Span[] = []
      for (const t of days.get(d) ?? []) {
        if (!t.start_time || replanIds.has(t.id) || (t.assigned_to && t.assigned_to !== uid)) continue
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
      map.set(d, spans)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, google.events, dayList, replanIds, uid])

  const now = new Date()
  const plan = useMemo(
    () =>
      planStudy({
        items: toPlan.map((x) => ({ id: x.item.id, title: x.item.title, minutes: x.st.remaining })).filter((x) => x.minutes > 0),
        from,
        to,
        winStart: clock(winStart || '09:00'),
        winEnd: clock(winEnd || '20:00'),
        today,
        nowMin: now.getHours() * 60 + now.getMinutes(),
        busy: (d) => busy_.get(d) ?? [],
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toPlan.map((x) => x.item.id + x.st.remaining).join(','), from, to, winStart, winEnd, busy_, today],
  )
  const total = toPlan.reduce((a, x) => a + x.st.remaining, 0)
  const planned = plan.blocks.reduce((a, b) => a + (b.end - b.start), 0)
  const byDay = useMemo(() => {
    const m = new Map<string, typeof plan.blocks>()
    for (const b of plan.blocks) m.set(b.date, [...(m.get(b.date) ?? []), b])
    return [...m.entries()]
  }, [plan])

  async function confirm() {
    if (!profile || !plan.blocks.length) return
    setBusy(true)
    setErr('')
    try {
      localStorage.setItem(KEY, JSON.stringify({ winStart, winEnd }))
    } catch {
      /* fine */
    }
    const e = await commitPlan(plan.blocks, replan ? alreadyPlanned.map((x) => x.item) : [], { householdId: profile.household_id, userId: uid, items, tasks, googleConnected, deleteTask }, today)
    setBusy(false)
    if (e) setErr(e)
    else onClose()
  }

  return (
    <div className="sheet-backdrop" ref={backdropRef} onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Plan your study time">
        <div className="sheet-head">
          <h2>Plan with Muna</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={22} />
          </button>
        </div>

        <div className="field">
          <span>Which weeks</span>
          <div className="ml-slotline">
            {weeks.map((w) => (
              <button key={w} className={'ml-toggle' + (picked.includes(w) ? ' on' : '')} onClick={() => setPicked((p) => (p.includes(w) ? p.filter((x) => x !== w) : [...p, w]))} aria-pressed={picked.includes(w)}>
                Week {w}
              </button>
            ))}
          </div>
        </div>

        <div className="row-2">
          <label className="field">
            <span>Study from</span>
            <input type="date" value={from} min={today} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>until (including)</span>
            <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </label>
        </div>
        <div className="row-2">
          <label className="field">
            <span>Not before</span>
            <input type="time" value={winStart} onChange={(e) => setWinStart(e.target.value)} />
          </label>
          <label className="field">
            <span>Not after</span>
            <input type="time" value={winEnd} onChange={(e) => setWinEnd(e.target.value)} />
          </label>
        </div>

        {alreadyPlanned.length > 0 && (
          <label className="check-row">
            <input type="checkbox" checked={replan} onChange={(e) => setReplan(e.target.checked)} />
            <span className="small">
              Also move the {alreadyPlanned.length} item{alreadyPlanned.length === 1 ? '' : 's'} that {alreadyPlanned.length === 1 ? 'is' : 'are'} already in my calendar
            </span>
          </label>
        )}

        {from > to && <p className="error">The last day is before the first day.</p>}
        {toPlan.length === 0 && from <= to && <p className="muted small">{mine.length ? 'Everything in these weeks is already planned or done.' : 'Choose at least one week.'}</p>}

        {toPlan.length > 0 && from <= to && (
          <div className="uni-plan">
            <p className="small">
              <strong>{duration(planned)}</strong> of {duration(total)} fits in {plan.usedDays} day{plan.usedDays === 1 ? '' : 's'}, around everything already in your calendar.
            </p>
            {plan.left.length > 0 && (
              <p className="wx-warn">
                {duration(plan.left.reduce((a, l) => a + l.minutes, 0))} does not fit: {plan.left.map((l) => l.title).join(', ')}. Add more days or longer study hours.
              </p>
            )}
            {byDay.map(([d, bs]) => (
              <div key={d} className="uni-day">
                <strong>{niceDay(d)}</strong>
                {bs.map((b) => (
                  <div key={b.itemId + b.start} className="uni-block">
                    <span className="muted small">
                      {fmtMin(b.start)}–{fmtMin(b.end)}
                    </span>
                    <span>
                      {b.title}
                      {b.parts > 1 ? ` (${b.part}/${b.parts})` : ''}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {err && <p className="error">{err}</p>}
        <div className="sheet-actions">
          <button className="btn primary grow" onClick={() => void confirm()} disabled={busy || !plan.blocks.length}>
            {busy ? 'Adding…' : plan.blocks.length ? 'Add to my calendar' : 'Nothing to add'}
          </button>
        </div>
      </div>
    </div>
  )
}
