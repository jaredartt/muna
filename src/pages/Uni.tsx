import { useEffect, useMemo, useRef, useState } from 'react'
import { IconCheck, IconChevronDown, IconChevronLeft, IconPlus, IconSparkles, IconTrashFilled, IconX } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../components/Confirm'
import { useTasksCtx } from '../context/TasksContext'
import { useGoogleEvents } from '../hooks/useGoogleEvents'
import { useSheetScrollGuard } from '../hooks/useSheetScrollGuard'
import { useAnimatedClose } from '../hooks/useAnimatedClose'
import { addDays, parseDateStr, todayStr } from '../lib/dates'
import { navigate } from '../lib/router'
import { addCourse, addUniItem, commitPlan, currentWeekOf, deleteCourse, deleteUniItem, duration, fmtMin, itemState, looseUniTasks, reorderUniItems, setCurrentWeek, unplanItem, updateCourse, updateUniItem, useUniCourses, useUniItems, useUniSettings, weekProgress, type UniCourse, type UniItem } from '../lib/uni'
import { daysBetween, planStudy, type Span } from '../lib/uniPlan'
import { assigneeColor } from '../lib/people'
import { TASK_COLORS } from '../lib/icons'
import SkipDays from '../components/SkipDays'
import { useSkips } from '../lib/skips'
import { useReorder } from '../hooks/useReorder'

const niceDay = (d: string) => parseDateStr(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const clock = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const hoursText = (min: number) => String(Math.round((min / 60) * 100) / 100)

export default function Uni() {
  const { session, profile } = useAuth()
  const { tasks, toggleTask, openEditor } = useTasksCtx()
  const uid = session?.user.id ?? ''
  const all = useUniItems()
  const items = useMemo(() => all.filter((i) => i.created_by === uid), [all, uid])
  const setting = useUniSettings().find((s) => s.user_id === uid)
  const today = todayStr()
  const current = currentWeekOf(items, tasks, setting, today)
  // courses first (a dropdown: all courses or one course); then that course's weeks
  const courses = useUniCourses().filter((c) => c.created_by === uid)
  const [courseSel, setCourseSel] = useState<string>('all')
  const selCourse = courses.find((c) => c.id === courseSel) ?? null
  const scope = selCourse ? selCourse.id : 'all'
  const scoped = useMemo(() => (scope === 'all' ? items : items.filter((i) => i.course_id === scope)), [items, scope])
  const weeks = useMemo(() => [...new Set([...scoped.map((i) => i.week), ...(current ? [current] : [])])].sort((a, b) => a - b), [scoped, current])
  const [week, setWeek] = useState<number | null>(null)
  const shown = week ?? current ?? 1
  const list = scoped.filter((i) => i.week === shown)
  const loose = looseUniTasks(items, tasks, uid, today).sort((a, b) => Number(a.completed) - Number(b.completed) || (a.due_date ?? '').localeCompare(b.due_date ?? '') || (a.start_time ?? '').localeCompare(b.start_time ?? ''))
  const prog = weekProgress(scoped, tasks, shown, today, shown === current && scope === 'all' ? loose : [])
  const [planning, setPlanning] = useState(false)
  const rd = useReorder({ columns: [list.map((i) => i.id)], onChange: (c) => void reorderUniItems(c[0]), enabled: !planning })
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
  const [addCourseId, setAddCourseId] = useState('')
  useEffect(() => setAddCourseId(selCourse ? selCourse.id : ''), [selCourse?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // course editing
  const [newCourse, setNewCourse] = useState<{ name: string; color: string } | null>(null)
  const [editCourse, setEditCourse] = useState(false)
  const [courseName, setCourseName] = useState('')
  useEffect(() => {
    setCourseName(selCourse?.name ?? '')
    setEditCourse(false)
  }, [selCourse?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const { confirm } = useConfirm()
  async function createCourse() {
    if (!profile || !newCourse?.name.trim()) return
    const r = await addCourse(profile.household_id, uid, newCourse.name, newCourse.color)
    if (r.error) return setErr(r.error)
    setNewCourse(null)
    if (r.id) setCourseSel(r.id)
  }
  async function add() {
    const m = Math.round(Number(hours.replace(',', '.')) * 60)
    if (!profile || !title.trim()) return
    if (!(m >= 5)) return setErr('How long do you plan to spend? For example 1.5 (hours).')
    setErr('')
    const e = await addUniItem(profile.household_id, uid, shown, title, Math.min(2400, Math.round(m / 5) * 5), [], addCourseId || null)
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
        <label className="uni-weekno uni-course-pick">
          <span>Course</span>
          <select
            value={scope}
            onChange={(e) => {
              if (e.target.value === '__new') setNewCourse({ name: '', color: TASK_COLORS[courses.length % TASK_COLORS.length] })
              else {
                setNewCourse(null)
                setCourseSel(e.target.value)
              }
            }}
            aria-label="Course"
          >
            <option value="all">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="__new">+ New course…</option>
          </select>
          {selCourse && <i className={'course-dot c-' + selCourse.color} />}
        </label>
        {newCourse && (
          <div className="uni-edit course-edit">
            <div className="uni-add">
              <input value={newCourse.name} onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && void createCourse()} placeholder="Course name, e.g. Art history" maxLength={40} autoFocus aria-label="Course name" />
              <button className="btn primary" onClick={() => void createCourse()} disabled={!newCourse.name.trim()} aria-label="Add course">
                <IconPlus size={20} />
              </button>
            </div>
            <div className="swatches">
              {TASK_COLORS.map((c) => (
                <button type="button" key={c} className={`swatch c-${c}` + (newCourse.color === c ? ' selected' : '')} onClick={() => setNewCourse({ ...newCourse, color: c })} aria-label={c} />
              ))}
            </div>
          </div>
        )}
        {selCourse && (
          <>
            <button className="ml-toggle" style={{ alignSelf: 'flex-start' }} onClick={() => setEditCourse((o) => !o)} aria-expanded={editCourse}>
              {editCourse ? 'Close' : `Edit ${selCourse.name}`}
            </button>
            {editCourse && (
              <div className="uni-edit course-edit">
                <input
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  onBlur={() => {
                    const n = courseName.trim()
                    if (n && n !== selCourse.name) void updateCourse(selCourse.id, { name: n })
                    else setCourseName(selCourse.name)
                  }}
                  maxLength={40}
                  aria-label="Course name"
                />
                <div className="swatches">
                  {TASK_COLORS.map((c) => (
                    <button type="button" key={c} className={`swatch c-${c}` + (selCourse.color === c ? ' selected' : '')} onClick={() => void updateCourse(selCourse.id, { color: c })} aria-label={c} />
                  ))}
                </div>
                <button
                  type="button"
                  className="ml-toggle"
                  onClick={async () => {
                    if (await confirm({ message: <>Delete the course <strong>{selCourse.name}</strong>? Its assignments stay, they just have no course.</> })) {
                      await deleteCourse(selCourse.id)
                      setCourseSel('all')
                    }
                  }}
                >
                  <IconTrashFilled size={14} /> Delete course
                </button>
              </div>
            )}
          </>
        )}
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
          <strong>{selCourse ? `${selCourse.name} · ` : ''}Week {shown}</strong>
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
        {courses.length > 0 && (
          <select value={addCourseId} onChange={(e) => setAddCourseId(e.target.value)} aria-label="Course">
            {!addCourseId && <option value="">Choose a course</option>}
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
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
        <h3>{selCourse ? `${selCourse.name} · ` : ''}Week {shown}</h3>
        {list.length === 0 && <p className="muted small">Add what you have to do this week, then let Muna find the time for it.</p>}
        {list.length > 1 && <p className="muted small">Press and hold an item to move it.</p>}
        <div className="uni-list" ref={rd.column(0)}>
          {list.map((i) => (
            <div key={i.id} {...rd.item(i.id)}>
              <Row item={i} today={today} courses={courses} showCourse={scope === 'all'} />
            </div>
          ))}
        </div>
        {list.length > 0 && (
          <button className="btn primary" onClick={() => setPlanning(true)}>
            <IconSparkles size={20} /> {needPlan.length ? `Plan ${needPlan.length} item${needPlan.length === 1 ? '' : 's'} with Muna` : 'Plan with Muna'}
          </button>
        )}
      </section>

      {scope === 'all' && loose.length > 0 && (
        <section className="card">
          <h3>Other uni tasks this week</h3>
          <p className="muted small">Tasks you marked as Uni in the calendar. They count in your Uni block too.</p>
          {loose.map((t) => (
            <div key={t.id} className={'cl-row' + (t.completed ? ' done' : '')}>
              <button type="button" className={'check' + (t.completed ? ' checked' : '')} onClick={() => void toggleTask(t)} aria-label={t.completed ? 'Mark as not done' : 'Mark as done'} aria-pressed={t.completed}>
                {t.completed && <IconCheck size={16} stroke={3} />}
              </button>
              <button type="button" className="cl-text" style={{ textAlign: 'left' }} onClick={() => openEditor(t)}>
                {t.title}
                <small className="muted"> {niceDay(t.due_date ?? today)}{t.start_time ? ` ${t.start_time.slice(0, 5)}` : ''}</small>
              </button>
            </div>
          ))}
        </section>
      )}

      {planning && <PlanSheet weeks={weeks} startWeek={shown} items={items} onClose={() => setPlanning(false)} />}
    </div>
  )
}

function Row({ item, today, courses, showCourse }: { item: UniItem; today: string; courses: UniCourse[]; showCourse: boolean }) {
  const { tasks, toggleTask, deleteTask } = useTasksCtx()
  const { confirm } = useConfirm()
  const [open, setOpen] = useState(false)
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
      // undo: the item and every block of it that was ticked
      await updateUniItem(item.id, { done: false })
      for (const t of st.linked) if (t.completed) void toggleTask(t)
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
            {showCourse && courses.find((c) => c.id === item.course_id) ? `${courses.find((c) => c.id === item.course_id)!.name} · ` : ''}
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
          {courses.length > 0 && (
            <label className="uni-weekno">
              <span>Course</span>
              <select value={item.course_id ?? ''} onChange={(e) => e.target.value && void updateUniItem(item.id, { course_id: e.target.value })} aria-label="Course of this item">
                {!item.course_id && <option value="">Choose a course</option>}
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="uni-weekno">
            <span>Week</span>
            <input type="number" inputMode="numeric" min="1" max="99" value={wk} onChange={(e) => setWk(e.target.value.replace(/\D/g, '').slice(0, 2))} onBlur={saveWeek} aria-label="Week of this item" />
          </label>
          {st.linked.some((t) => !t.completed) && (
            <button
              type="button"
              className="ml-toggle"
              onClick={async () => {
                const ok = await confirm({ message: <>Take <strong>{item.title}</strong> off your calendar? The item stays in your list.</>, confirmLabel: 'Take off' })
                if (ok) await unplanItem(item, { tasks, deleteTask }, today)
              }}
            >
              Take it off my calendar
            </button>
          )}
          <button
            type="button"
            className="ml-toggle"
            onClick={async () => {
              const ok = await confirm({ message: <>Delete <strong>{item.title}</strong>{st.linked.some((t) => !t.completed) ? ' and its blocks in your calendar' : ''}?</> })
              if (!ok) return
              await unplanItem(item, { tasks, deleteTask }, today)
              await deleteUniItem(item.id)
            }}
          >
            <IconTrashFilled size={14} /> Delete
          </button>
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
  const { leaving, close } = useAnimatedClose(onClose)
  const { session, profile, googleConnected, members } = useAuth()
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
  const skip = useSkips('uni', uid) // days Muna must not plan on

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
        skip,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toPlan.map((x) => x.item.id + x.st.remaining).join(','), from, to, winStart, winEnd, busy_, today, skip.join(',')],
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
    const e = await commitPlan(plan.blocks, replan ? alreadyPlanned.map((x) => x.item) : [], { householdId: profile.household_id, userId: uid, items, tasks, googleConnected, deleteTask, color: assigneeColor(uid, members, uid) }, today)
    setBusy(false)
    if (e) setErr(e)
    else close()
  }

  return (
    <div className={'sheet-backdrop sheet-anim' + (leaving ? ' leaving' : '')} ref={backdropRef} onClick={close}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Plan your study time">
        <div className="sheet-head">
          <h2>Plan with Muna</h2>
          <button className="icon-btn" onClick={close} aria-label="Close">
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

        <SkipDays area="uni" days={dayList.filter((d) => d >= today)} title="Skip these days" />

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
