import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { IconChefHatFilled, IconCheck, IconMoonFilled, IconSchool, IconStarFilled, IconTrashFilled, IconX } from '@tabler/icons-react'
import Ring from './Ring'
import { useConfirm } from './Confirm'
import { useSheetScrollGuard } from '../hooks/useSheetScrollGuard'
import { useAuth } from '../context/AuthContext'
import { useTasksCtx } from '../context/TasksContext'
import { useProducts } from '../lib/products'
import { productMap, recipeMacros, round, SLOTS, usePlan, useRecipes } from '../lib/meals'
import { deleteSleep, hm, saveSleep, SLEEP_GOAL_MIN, sleepAverage, sleepDefaults, sleepMinutes, useSleep } from '../lib/sleep'
import { addDays, formatDateNice, parseDateStr, todayStr } from '../lib/dates'
import { navigate } from '../lib/router'
import { currentWeekOf, duration, looseUniTasks, useUniItems, useUniSettings, weekProgress } from '../lib/uni'
import type { Category, Task } from '../lib/types'

type Anim = { className: string; style: CSSProperties }

// ---------- Sleep ----------
export function SleepCard({ anim }: { anim: Anim }) {
  const { session } = useAuth()
  const rows = useSleep()
  const [open, setOpen] = useState(false)
  const today = todayStr()
  const { avg, nights } = sleepAverage(rows, session?.user.id ?? '', today)
  return (
    <>
      <section className={'card ring-card tap' + anim.className} style={anim.style}>
        <button className="card-tap" onClick={() => setOpen(true)} aria-label="Log your sleep">
          <div className="card-head">
            <h3>Sleep</h3>
            <span className="plain-icon purple">
              <IconMoonFilled size={24} />
            </span>
          </div>
          <Ring pct={avg === null ? 0 : (avg / SLEEP_GOAL_MIN) * 100} color="var(--purple)" value={avg === null ? '–' : `${(avg / 60).toFixed(1)}h`} label={avg === null ? 'tap to log' : `avg · ${nights}/7 nights`} labelBelow />
        </button>
      </section>
      {open && <SleepSheet onClose={() => setOpen(false)} />}
    </>
  )
}

function SleepSheet({ onClose }: { onClose: () => void }) {
  const { confirm } = useConfirm()
  const backdropRef = useRef<HTMLDivElement>(null)
  useSheetScrollGuard(backdropRef)
  const { session, profile } = useAuth()
  const rows = useSleep()
  const uid = session?.user.id ?? ''
  const today = todayStr()
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)) // the last 7 mornings, today last
  const [day, setDay] = useState(today)
  const existing = rows.find((r) => r.user_id === uid && r.day === day)
  const def = sleepDefaults(day)
  const [bed, setBed] = useState(existing?.bed_time.slice(0, 5) ?? def.bed)
  const [wake, setWake] = useState(existing?.wake_time.slice(0, 5) ?? def.wake)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // switching day loads that morning's saved times, or the suggestion
  useEffect(() => {
    const e = rows.find((r) => r.user_id === uid && r.day === day)
    const d = sleepDefaults(day)
    setBed(e?.bed_time.slice(0, 5) ?? d.bed)
    setWake(e?.wake_time.slice(0, 5) ?? d.wake)
    setErr('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day])

  async function save() {
    if (!profile || !bed || !wake) return
    setBusy(true)
    const e = await saveSleep(profile.household_id, uid, day, bed, wake)
    setBusy(false)
    if (e) setErr(e)
    else onClose()
  }
  async function remove() {
    if (!existing) return
    if (!(await confirm({ message: <>Remove your sleep for {formatDateNice(day)}?</>, confirmLabel: 'Remove' }))) return
    setBusy(true)
    const e = await deleteSleep(existing.id)
    setBusy(false)
    if (e) setErr(e)
    else onClose()
  }

  const preview = bed && wake ? hm(sleepMinutes(bed, wake)) : ''
  return (
    <div className="sheet-backdrop" ref={backdropRef} onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Log your sleep">
        <div className="sheet-head">
          <h2>Your sleep</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={22} />
          </button>
        </div>
        <div className="field">
          <span>The morning you woke up</span>
          <div className="sl-days">
            {days.map((d) => (
              <button key={d} className={'day-chip' + (d === day ? ' on' : '')} onClick={() => setDay(d)} aria-pressed={d === day}>
                {d === today ? 'Today' : parseDateStr(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}
              </button>
            ))}
          </div>
        </div>
        <div className="row-2">
          <label className="field">
            <span>Went to sleep</span>
            <input type="time" value={bed} onChange={(e) => setBed(e.target.value)} className={existing ? '' : 'sl-suggest'} />
          </label>
          <label className="field">
            <span>Woke up</span>
            <input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className={existing ? '' : 'sl-suggest'} />
          </label>
        </div>
        <p className="muted small">
          {existing ? 'Saved for ' : 'Suggested times for '}
          {formatDateNice(day)}
          {preview ? ` · ${preview} of sleep` : ''}.{existing ? '' : ' Nothing is counted until you press Save.'}
        </p>
        {err && <p className="error">{err}</p>}
        <div className="sheet-actions">
          {existing && (
            <button className="btn danger" onClick={() => void remove()} disabled={busy}>
              <IconTrashFilled size={18} /> Remove
            </button>
          )}
          <button className="btn primary grow" onClick={() => void save()} disabled={busy || !bed || !wake}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Calories (today's meal plan against your target) ----------
export function CaloriesCard({ anim }: { anim: Anim }) {
  const { session, profile } = useAuth()
  const plan = usePlan()
  const recipes = useRecipes()
  const products = useProducts()
  const today = todayStr()
  const pmap = productMap(products)
  let kcal = 0
  let meals = 0
  for (const s of SLOTS) {
    const row = plan.find((p) => p.plan_date === today && p.slot === s.key)
    const r = row && recipes.find((x) => x.id === row.recipe_id)
    if (!r) continue
    meals++
    kcal += recipeMacros(r, session?.user.id ?? '', pmap).kcal
  }
  const target = profile?.targets?.kcal || 2000
  return (
    <section className={'card ring-card tap' + anim.className} style={anim.style}>
      <button className="card-tap" onClick={() => navigate('/meals')} aria-label="Open meals">
        <div className="card-head">
          <h3>Calories</h3>
          <span className="plain-icon green">
            <IconChefHatFilled size={24} />
          </span>
        </div>
        <Ring pct={(kcal / target) * 100} color="var(--green)" value={meals ? String(round(kcal)) : '–'} label={meals ? 'Kcal' : 'no meals planned'} labelBelow />
      </button>
    </section>
  )
}

// ---------- Uni and Goals (share of the tasks of that category that are done) ----------
const CAT = {
  uni: { title: 'Uni', color: 'var(--blue)', Icon: IconSchool, cls: 'blue' },
  goal: { title: 'Goals', color: 'var(--yellow)', Icon: IconStarFilled, cls: 'yellow' },
} as const

/** One-off tasks of a category that still matter: open ones, and ones finished in the last 30 days. */
function relevant(tasks: Task[], cat: Category): Task[] {
  const limit = Date.now() - 30 * 86400000
  return tasks.filter((t) => t.category === cat && !t.repeat && (!t.completed || !t.completed_at || new Date(t.completed_at).getTime() >= limit))
}

export function CategoryCard({ cat, anim }: { cat: Category; anim: Anim }) {
  const { tasks } = useTasksCtx()
  const [open, setOpen] = useState(false)
  const list = relevant(tasks, cat)
  const done = list.filter((t) => t.completed).length
  const pct = list.length ? Math.round((done / list.length) * 100) : 0
  const { title, color, Icon, cls } = CAT[cat]
  return (
    <>
      <section className={'card ring-card tap' + anim.className} style={anim.style}>
        <button className="card-tap" onClick={() => setOpen(true)} aria-label={`Open ${title} tasks`}>
          <div className="card-head">
            <h3>{title}</h3>
            <span className={`plain-icon ${cls}`}>
              <Icon size={24} />
            </span>
          </div>
          <Ring pct={pct} color={color} value={list.length ? `${pct}%` : '–'} label={list.length ? `${done} of ${list.length} tasks` : 'no tasks yet'} />
        </button>
      </section>
      {open && <CategorySheet cat={cat} onClose={() => setOpen(false)} />}
    </>
  )
}

function CategorySheet({ cat, onClose }: { cat: Category; onClose: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null)
  useSheetScrollGuard(backdropRef)
  const { tasks, toggleTask, openEditor } = useTasksCtx()
  const list = relevant(tasks, cat).sort((a, b) => Number(a.completed) - Number(b.completed) || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
  return (
    <div className="sheet-backdrop" ref={backdropRef} onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${CAT[cat].title} tasks`}>
        <div className="sheet-head">
          <h2>{CAT[cat].title} tasks</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={22} />
          </button>
        </div>
        {list.length === 0 && <p className="muted small">Nothing here yet. Open any task and choose &ldquo;{CAT[cat].title}&rdquo; under &ldquo;Counts for&rdquo;, or ask Muna to add one.</p>}
        <div className="cl">
          {list.map((t) => (
            <div key={t.id} className={'cl-row' + (t.completed ? ' done' : '')}>
              <button type="button" className={'check' + (t.completed ? ' checked' : '')} onClick={() => toggleTask(t)} aria-label={t.completed ? 'Mark as not done' : 'Mark as done'} aria-pressed={t.completed}>
                {t.completed && <IconCheck size={16} stroke={3} />}
              </button>
              <button
                type="button"
                className="cl-text"
                style={{ textAlign: 'left' }}
                onClick={() => {
                  onClose()
                  openEditor(t)
                }}
              >
                {t.title}
                {t.due_date && <small className="muted"> {formatDateNice(t.due_date)}</small>}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------- Uni (this week: minutes done out of the minutes you planned for the week's assignments) ----------
export function UniCard({ anim }: { anim: Anim }) {
  const { session } = useAuth()
  const { tasks } = useTasksCtx()
  const uid = session?.user.id ?? ''
  const items = useUniItems().filter((i) => i.created_by === uid)
  const setting = useUniSettings().find((s) => s.user_id === uid)
  const today = todayStr()
  const week = currentWeekOf(items, tasks, setting, today)
  const loose = looseUniTasks(items, tasks, uid, today)
  const { done, total } = week === null && !loose.length ? { done: 0, total: 0 } : weekProgress(items, tasks, week ?? 0, today, loose)
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <section className={'card ring-card tap' + anim.className} style={anim.style}>
      <button className="card-tap" onClick={() => navigate('/uni')} aria-label="Open Uni">
        <div className="card-head">
          <h3>Uni</h3>
          <span className="plain-icon blue">
            <IconSchool size={24} />
          </span>
        </div>
        <Ring pct={pct} color="var(--blue)" value={total ? `${pct}%` : '–'} label={total ? `${week === null ? 'This week' : `Week ${week}`}\n${duration(done)} of ${duration(total)}` : 'add your assignments'} labelBelow />
      </button>
    </section>
  )
}
