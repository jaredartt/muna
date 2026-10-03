import { useEffect, useRef, useState } from 'react'
import { IconChevronLeft, IconPlus, IconSparkles, IconTrashFilled, IconX } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../components/Confirm'
import { useTasksCtx } from '../context/TasksContext'
import IconPicker from '../components/IconPicker'
import { dayWord } from '../components/HobbiesCard'
import { useSheetScrollGuard } from '../hooks/useSheetScrollGuard'
import { useHobbyPlanner, weeksToPlan } from '../hooks/useHobbyPlanner'
import { TASK_ICONS, TASK_COLORS, TaskIcon } from '../lib/icons'
import { todayStr } from '../lib/dates'
import { navigate } from '../lib/router'
import { addHobby, DAY_NAMES, deleteHobby, emptyHobby, hoursLabel, TIMES, updateHobby, useHobbies, useHobbySessions, type Hobby, type HobbyDraft } from '../lib/hobbies'

export default function Hobbies() {
  const { session, profile } = useAuth()
  const { tasks } = useTasksCtx()
  const uid = session?.user.id ?? ''
  const hobbies = useHobbies().filter((h) => h.created_by === uid)
  const sessions = useHobbySessions()
  const today = todayStr()
  const plan = useHobbyPlanner()
  const [editing, setEditing] = useState<Hobby | 'new' | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const byId = new Map(tasks.map((t) => [t.id, t]))
  const upcoming = sessions
    .filter((s) => hobbies.some((h) => h.id === s.hobby_id) && s.task_id)
    .map((s) => ({ s, h: hobbies.find((h) => h.id === s.hobby_id)!, t: byId.get(s.task_id!) }))
    .filter((x) => x.t && !x.t.completed && (x.t.due_date ?? '') >= today)
    .sort((a, b) => (a.t!.due_date ?? '').localeCompare(b.t!.due_date ?? '') || (a.t!.start_time ?? '').localeCompare(b.t!.start_time ?? ''))

  async function replan() {
    setBusy(true)
    setMsg('')
    let n = 0
    const short: string[] = []
    let error = ''
    for (const ws of weeksToPlan(today)) {
      const r = await plan(ws, { replan: true })
      n += r.planned
      short.push(...r.short)
      if (r.error) error = r.error
    }
    setBusy(false)
    setMsg(error || `${n ? `Planned ${n} time${n === 1 ? '' : 's'}.` : 'Nothing new fits.'}${short.length ? ` No free time found for ${[...new Set(short)].join(', ')}.` : ''}`)
  }

  if (!profile) return null
  return (
    <div className="page">
      <header className="page-head">
        <div className="updates-title">
          <button className="icon-btn" onClick={() => navigate('/')} aria-label="Back to Home">
            <IconChevronLeft size={24} />
          </button>
          <h1>Hobbies</h1>
        </div>
      </header>

      <section className="card">
        <h3>Coming up</h3>
        <p className="muted small">Every Saturday Muna looks at your calendar for the next week and puts your hobbies in the free time. A week with only one workable day gets that day; otherwise she picks the days you prefer.</p>
        {upcoming.length === 0 && <p className="muted small">{hobbies.length ? 'Nothing planned yet.' : 'Add a hobby below to get started.'}</p>}
        {upcoming.map(({ s, h, t }) => (
          <div key={s.id} className="mini-task">
            <span className={`tile c-${h.color}`}>
              <TaskIcon name={h.icon} size={18} />
            </span>
            <span className="mini-title">
              {h.name}
              <small className="muted">
                {' '}
                {dayWord(t!.due_date ?? today, today)} {t!.start_time?.slice(0, 5)}–{t!.end_time?.slice(0, 5)}
              </small>
            </span>
          </div>
        ))}
        {hobbies.some((h) => h.active) && (
          <button className="btn soft" onClick={() => void replan()} disabled={busy}>
            <IconSparkles size={18} /> {busy ? 'Planning…' : 'Plan again'}
          </button>
        )}
        {msg && <p className="muted small">{msg}</p>}
      </section>

      <section className="card">
        <h3>My hobbies</h3>
        {hobbies.length === 0 && <p className="muted small">Nothing yet.</p>}
        {hobbies.map((h) => (
          <button key={h.id} className="ml-row" onClick={() => setEditing(h)}>
            <span className={`tile c-${h.color}`}>
              <TaskIcon name={h.icon} size={18} />
            </span>
            <span className="ml-row-main">
              <strong>
                {h.name}
                {!h.active && <span className="muted small"> (paused)</span>}
              </strong>
              <span className="muted small">
                {hoursLabel(h.minutes)} · {h.per_week}× a week{h.days.length ? ` · ${h.days.map((d) => DAY_NAMES[d]).join(', ')}` : ''}
              </span>
            </span>
          </button>
        ))}
        <button className="btn primary" onClick={() => setEditing('new')}>
          <IconPlus size={18} /> New hobby
        </button>
      </section>

      {editing && <HobbySheet hobby={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

const parseHours = (s: string) => Math.round((Number(s.replace(',', '.')) * 60) / 15) * 15
const hoursText = (m: number) => String(Math.round((m / 60) * 100) / 100)

function HobbySheet({ hobby, onClose }: { hobby: Hobby | null; onClose: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null)
  useSheetScrollGuard(backdropRef)
  const { session, profile } = useAuth()
  const { tasks, deleteTask } = useTasksCtx()
  const uid = session?.user.id ?? ''
  const isNew = !hobby
  const [d, setD] = useState<HobbyDraft>(() => (hobby ? { name: hobby.name, description: hobby.description, icon: hobby.icon, color: hobby.color, minutes: hobby.minutes, per_week: hobby.per_week, days: hobby.days, time_of_day: hobby.time_of_day, active: hobby.active } : emptyHobby()))
  const [hours, setHours] = useState(hoursText(d.minutes))
  const { confirm: confirmAsk } = useConfirm()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [status, setStatus] = useState('')

  // an existing hobby saves itself a moment after each change (also when the sheet closes)
  const dirty = useRef(false)
  const latest = useRef(d)
  latest.current = d
  const timer = useRef<number | undefined>(undefined)
  function flush() {
    window.clearTimeout(timer.current)
    if (!hobby || !dirty.current || !latest.current.name.trim()) return
    dirty.current = false
    setStatus('Saving…')
    void updateHobby(hobby.id, { ...latest.current, name: latest.current.name.trim() }).then((e) => setStatus(e ? '' : 'Saved ✓'))
  }
  useEffect(() => () => flush(), []) // eslint-disable-line react-hooks/exhaustive-deps
  function set(patch: Partial<HobbyDraft>) {
    setD((x) => ({ ...x, ...patch }))
    if (!hobby) return
    dirty.current = true
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, 800)
  }

  async function add() {
    if (!profile || !d.name.trim()) return
    setBusy(true)
    const e = await addHobby(profile.household_id, uid, d)
    setBusy(false)
    if (e) setErr(e)
    else onClose()
  }

  return (
    <div className="sheet-backdrop" ref={backdropRef} onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={isNew ? 'New hobby' : 'Edit hobby'}>
        <div className="sheet-head">
          <h2>{isNew ? 'New hobby' : 'Your hobby'}</h2>
          <span className="autosave-state">{status}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={22} />
          </button>
        </div>

        <label className="field">
          <span>Name</span>
          <input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Guitar" />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea value={d.description} onChange={(e) => set({ description: e.target.value })} rows={2} placeholder="Anything to remember…" />
        </label>

        <div className="row-2">
          <label className="field">
            <span>How long it usually takes (hours)</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={hours}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.,]/g, '').slice(0, 5)
                setHours(v)
                const m = parseHours(v)
                if (m >= 15 && m <= 600) set({ minutes: m })
              }}
              onBlur={() => setHours(hoursText(d.minutes))}
            />
          </label>
          <div className="field">
            <span>Times a week</span>
            <div className="ml-slotline">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button key={n} type="button" className={'ml-toggle' + (d.per_week === n ? ' on' : '')} onClick={() => set({ per_week: n })} aria-pressed={d.per_week === n}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="field">
          <span>Days you prefer (Muna uses them when more than one day works)</span>
          <div className="ml-slotline">
            {DAY_NAMES.map((n, i) => (
              <button key={n} type="button" className={'ml-toggle' + (d.days.includes(i) ? ' on' : '')} onClick={() => set({ days: d.days.includes(i) ? d.days.filter((x) => x !== i) : [...d.days, i].sort() })} aria-pressed={d.days.includes(i)}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Time of day</span>
          <div className="ml-slotline">
            {TIMES.map((t) => (
              <button key={t.key} type="button" className={'ml-toggle' + (d.time_of_day === t.key ? ' on' : '')} onClick={() => set({ time_of_day: t.key })} aria-pressed={d.time_of_day === t.key}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Icon colour</span>
          <div className="swatches">
            {TASK_COLORS.map((c) => (
              <button key={c} type="button" className={`swatch c-${c}` + (d.color === c ? ' selected' : '')} onClick={() => set({ color: c })} aria-label={c} />
            ))}
          </div>
        </div>
        <div className="field">
          <span>Icon</span>
          <IconPicker value={d.icon} onChange={(v) => set({ icon: v })} suggestions={Object.keys(TASK_ICONS)} colorClass={`c-${d.color}`} />
        </div>

        {!isNew && (
          <label className="check-row">
            <input type="checkbox" checked={!d.active} onChange={(e) => set({ active: !e.target.checked })} />
            <span className="small">Pause this hobby (Muna stops planning it)</span>
          </label>
        )}
        {err && <p className="error">{err}</p>}

        {isNew && (
          <div className="sheet-actions">
            <button className="btn primary grow" onClick={() => void add()} disabled={busy || !d.name.trim()}>
              {busy ? 'Adding…' : 'Add hobby'}
            </button>
          </div>
        )}
        {hobby && (
          <button
            className="btn danger"
            onClick={async () => {
              const ok = await confirmAsk({ message: <>Delete <strong>{hobby.name}</strong> and its coming times in your calendar?</> })
              if (!ok) return
              dirty.current = false
              await deleteHobby(hobby, tasks, deleteTask, todayStr())
              onClose()
            }}
          >
            <IconTrashFilled size={18} /> Delete hobby
          </button>
        )}
      </div>
    </div>
  )
}
