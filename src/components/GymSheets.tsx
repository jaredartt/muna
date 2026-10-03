import { useMemo, useRef, useState } from 'react'
import { IconCheck, IconChevronDown, IconChevronUp, IconPlus, IconTrashFilled, IconX } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import { useTasksCtx } from '../context/TasksContext'
import { useConfirm } from './Confirm'
import SkipDays from './SkipDays'
import IconPicker from './IconPicker'
import { useSheetScrollGuard } from '../hooks/useSheetScrollGuard'
import { useAnimatedClose } from '../hooks/useAnimatedClose'
import { useReorder } from '../hooks/useReorder'
import { useBusy } from '../hooks/useBusy'
import { addDays, parseDateStr, todayStr } from '../lib/dates'
import { assigneeColor } from '../lib/people'
import { notifyTasksChanged } from '../lib/events'
import { syncTasksToGoogle } from '../lib/google'
import { supabase } from '../lib/supabase'
import { skippedDays } from '../lib/skips'
import { goalText } from '../lib/gymLogic'
import { planGym } from '../lib/gymPlan'
import { DAY_NAMES, TIMES } from '../lib/hobbies'
import type { TimeOfDay } from '../lib/hobbyPlan'
import {
  addExercise, addSessions, addSplit, guessSplitIcon, deleteExercise, deleteSplit, emptyExercise, reorderExercises, removeSessions, saveSettings, saveWorkout, updateExercise, updateSplit,
  useGymExercises, useGymLogs, useGymSessions, useGymSettings, type ExerciseDraft, type GymExercise, type GymSession, type GymSplit, type WorkoutResult,
} from '../lib/gym'
import type { Task } from '../lib/types'

/** "8,5" or "8.5" -> 8.5 (the iPhone number keyboard has a comma). */
export const toNum = (v: string): number => {
  const n = Number(v.replace(',', '.').trim())
  return Number.isFinite(n) ? n : NaN
}
const show = (n: number) => String(Math.round(n * 100) / 100)
const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const niceDay = (d: string) => parseDateStr(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })

function Sheet({ title, onClose, children, status }: { title: string; onClose: () => void; children: React.ReactNode; status?: string }) {
  const backdropRef = useRef<HTMLDivElement>(null)
  useSheetScrollGuard(backdropRef)
  const { leaving, close } = useAnimatedClose(onClose)
  return (
    <div className={'sheet-backdrop sheet-anim' + (leaving ? ' leaving' : '')} ref={backdropRef} onClick={close}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <span className="autosave-state">{status}</span>
          <button className="icon-btn" onClick={close} aria-label="Close">
            <IconX size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ======================= one exercise (add / edit form) =======================
function ExerciseForm({ initial, saveLabel, onSave, onDelete }: { initial: ExerciseDraft; saveLabel: string; onSave: (d: ExerciseDraft) => Promise<string | null>; onDelete?: () => void }) {
  const [name, setName] = useState(initial.name)
  const [sets, setSets] = useState(String(initial.sets))
  const [weight, setWeight] = useState(initial.weight ? show(initial.weight) : '')
  const [goal, setGoal] = useState(String(initial.goal_reps))
  const [start, setStart] = useState(String(initial.start_reps))
  const [max, setMax] = useState(String(initial.max_reps))
  const [step, setStep] = useState(show(initial.step))
  const [notes, setNotes] = useState(initial.notes)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    const d: ExerciseDraft = { name: name.trim(), sets: Math.round(toNum(sets)), weight: weight === '' ? 0 : toNum(weight), goal_reps: Math.round(toNum(goal)), start_reps: Math.round(toNum(start)), max_reps: Math.round(toNum(max)), step: toNum(step), notes }
    if (!d.name) return setErr('Give the exercise a name.')
    if (!(d.sets >= 1 && d.sets <= 12)) return setErr('Sets: between 1 and 12.')
    if (!(d.weight >= 0)) return setErr('The weight must be a number (0 for bodyweight).')
    if (!(d.start_reps >= 1 && d.max_reps >= d.start_reps && d.max_reps <= 100)) return setErr('Max reps must be at least the starting reps.')
    if (!(d.goal_reps >= 1 && d.goal_reps <= d.max_reps)) return setErr('The goal reps must be between 1 and the max reps.')
    if (!(d.step > 0)) return setErr('The step must be more than 0 kg.')
    setBusy(true)
    setErr('')
    const e = await onSave(d)
    setBusy(false)
    if (e) setErr(e)
  }
  return (
    <div className="gym-form">
      <label className="field">
        <span>Exercise</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bench press" maxLength={80} />
      </label>
      <div className="row-2">
        <label className="field">
          <span>Weight now (kg)</span>
          <input type="text" inputMode="decimal" autoComplete="off" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 7))} placeholder="0 = bodyweight" />
        </label>
        <label className="field">
          <span>Reps to reach now</span>
          <input type="text" inputMode="numeric" autoComplete="off" value={goal} onChange={(e) => setGoal(e.target.value.replace(/\D/g, '').slice(0, 3))} />
        </label>
      </div>
      <div className="row-2">
        <label className="field">
          <span>Sets</span>
          <input type="text" inputMode="numeric" autoComplete="off" value={sets} onChange={(e) => setSets(e.target.value.replace(/\D/g, '').slice(0, 2))} />
        </label>
        <label className="field">
          <span>Step when it gets heavier (kg)</span>
          <input type="text" inputMode="decimal" autoComplete="off" value={step} onChange={(e) => setStep(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 5))} />
        </label>
      </div>
      <div className="row-2">
        <label className="field">
          <span>Reps that make it heavier</span>
          <input type="text" inputMode="numeric" autoComplete="off" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, '').slice(0, 3))} />
        </label>
        <label className="field">
          <span>Reps again after that</span>
          <input type="text" inputMode="numeric" autoComplete="off" value={start} onChange={(e) => setStart(e.target.value.replace(/\D/g, '').slice(0, 3))} />
        </label>
      </div>
      <label className="field">
        <span>Notes</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Seat height, grip…" maxLength={200} />
      </label>
      {err && <p className="error">{err}</p>}
      <div className="sheet-actions">
        <button className="btn primary grow" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : saveLabel}
        </button>
        {onDelete && (
          <button className="btn danger" onClick={onDelete} aria-label="Delete exercise">
            <IconTrashFilled size={18} />
          </button>
        )}
      </div>
    </div>
  )
}

// ======================= a day of your split =======================
const SPLIT_ICONS = ['IconBarbellFilled', 'IconFlameFilled', 'IconAnchor', 'IconBikeFilled', 'IconBoltFilled', 'IconStarFilled', 'IconHeartFilled', 'IconTrophyFilled', 'IconRun', 'IconMountain', 'IconShieldFilled', 'IconSunFilled', 'IconMoonFilled', 'IconDiamondFilled']
export function SplitSheet({ split, onClose }: { split: GymSplit | null; onClose: () => void }) {
  const { session, profile } = useAuth()
  const { tasks, deleteTask } = useTasksCtx()
  const { confirm } = useConfirm()
  const uid = session?.user.id ?? ''
  const [id, setId] = useState(split?.id ?? null)
  const [name, setName] = useState(split?.name ?? '')
  const [icon, setIcon] = useState(split?.icon ?? '')
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<string | 'new' | null>(split ? null : null)
  const all = useGymExercises()
  const exercises = useMemo(() => all.filter((e) => e.split_id === id && e.created_by === uid).sort((a, b) => a.position - b.position), [all, id, uid])
  const sp = useReorder({
    columns: [exercises.map((e) => e.id)],
    onChange: (cols) => void reorderExercises(cols[0]),
    enabled: open === null,
  })

  async function create() {
    if (!profile || !name.trim()) return
    const r = await addSplit(profile.household_id, uid, name, icon || undefined)
    if (r.error) setErr(r.error)
    else {
      setId(r.id!)
      setOpen('new')
    }
  }
  // the name of an existing day saves itself when you leave the field
  async function rename() {
    if (!id || !name.trim() || name.trim() === split?.name) return
    const e = await updateSplit(id, { name: name.trim() })
    if (e) setErr(e)
  }
  // the icon of an existing day saves at once
  async function pickIcon(v: string) {
    setIcon(v)
    if (!id) return
    const e = await updateSplit(id, { icon: v })
    if (e) setErr(e)
  }
  const shownIcon = icon || guessSplitIcon(name)

  return (
    <Sheet title={id ? 'Training day' : 'New training day'} onClose={onClose}>
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => void rename()} placeholder="e.g. Push, Pull, Legs, Full upper" maxLength={40} onKeyDown={(e) => e.key === 'Enter' && (id ? (e.target as HTMLInputElement).blur() : void create())} />
      </label>
      <div className="field">
        <span>Icon</span>
        <IconPicker value={shownIcon} onChange={(v) => void pickIcon(v)} suggestions={SPLIT_ICONS} colorClass="c-mint" />
      </div>
      {!id && (
        <div className="sheet-actions">
          <button className="btn primary grow" onClick={() => void create()} disabled={!name.trim()}>
            Add training day
          </button>
        </div>
      )}
      {id && (
        <div className="field">
          <span>Exercises {exercises.length ? `(${exercises.length}) · press and hold to reorder` : ''}</span>
          <div className="gym-ex-list" ref={sp.column(0)}>
            {exercises.map((e) => (
              <div key={e.id} className="gym-ex" {...sp.item(e.id)}>
                <button className="gym-ex-head" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
                  <span className="ml-row-main">
                    <strong>{e.name}</strong>
                    <span className="muted small">
                      {e.sets} sets · now {goalText(e)}
                    </span>
                  </span>
                  {open === e.id ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
                </button>
                {open === e.id && (
                  <ExerciseForm
                    initial={e}
                    saveLabel="Save exercise"
                    onSave={async (d) => {
                      const r = await updateExercise(e.id, d)
                      if (!r) setOpen(null)
                      return r
                    }}
                    onDelete={async () => {
                      if (await confirm({ message: <>Delete <strong>{e.name}</strong> and everything you logged for it?</> })) {
                        await deleteExercise(e)
                        setOpen(null)
                      }
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          {open === 'new' ? (
            <div className="gym-ex">
              <ExerciseForm
                initial={emptyExercise()}
                saveLabel="Add exercise"
                onSave={async (d) => {
                  if (!profile || !id) return 'Not ready yet.'
                  const r = await addExercise(profile.household_id, uid, id, d)
                  if (!r) setOpen('new') // ready for the next one
                  return r
                }}
              />
            </div>
          ) : (
            <button className="btn soft" onClick={() => setOpen('new')}>
              <IconPlus size={18} /> Add exercise
            </button>
          )}
        </div>
      )}
      {err && <p className="error">{err}</p>}
      {id && split && (
        <button
          className="btn danger"
          onClick={async () => {
            if (await confirm({ message: <>Delete <strong>{split.name}</strong>, its exercises and its coming sessions in your calendar?</> })) {
              await deleteSplit(split, tasks, deleteTask, todayStr())
              onClose()
            }
          }}
        >
          <IconTrashFilled size={18} /> Delete training day
        </button>
      )}
    </Sheet>
  )
}

// ======================= doing a workout =======================
type SetRow = { weight: string; reps: string }

export function WorkoutSheet({ split, session, task, onClose }: { split: GymSplit; session: GymSession | null; task: Task | null; onClose: () => void }) {
  const { session: auth, profile } = useAuth()
  const { toggleTask } = useTasksCtx()
  const uid = auth?.user.id ?? ''
  const allEx = useGymExercises()
  const logs = useGymLogs()
  const exercises = useMemo(() => allEx.filter((e) => e.split_id === split.id && e.created_by === uid).sort((a, b) => a.position - b.position), [allEx, split.id, uid])
  const [day, setDay] = useState(todayStr())
  const [rows, setRows] = useState<Record<string, SetRow[]>>(() => Object.fromEntries(exercises.map((e) => [e.id, Array.from({ length: e.sets }, () => ({ weight: e.weight ? show(e.weight) : '', reps: '' }))])))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [results, setResults] = useState<WorkoutResult[] | null>(null)

  const lastTime = (exId: string) => {
    const mine = logs.filter((l) => l.exercise_id === exId && l.day < day)
    if (!mine.length) return ''
    const d = mine[mine.length - 1].day
    return mine.filter((l) => l.day === d).map((l) => `${Number(l.weight) ? show(Number(l.weight)) + '×' : ''}${l.reps}`).join(', ')
  }
  const setRow = (exId: string, i: number, patch: Partial<SetRow>) => setRows((r) => ({ ...r, [exId]: r[exId].map((x, j) => (j === i ? { ...x, ...patch } : x)) }))

  async function finish() {
    if (!profile) return
    const entries = exercises
      .map((e) => ({
        exercise: e,
        sets: (rows[e.id] ?? []).map((r) => ({ weight: r.weight === '' ? 0 : toNum(r.weight), reps: Math.round(toNum(r.reps)) })).filter((s) => s.reps > 0 && s.weight >= 0),
      }))
      .filter((e) => e.sets.length)
    if (!entries.length) return setErr('Fill in the reps of at least one set.')
    setBusy(true)
    setErr('')
    const r = await saveWorkout({ householdId: profile.household_id, userId: uid, day, entries, session, task, toggleTask })
    setBusy(false)
    if (r.error) setErr(r.error)
    else setResults(r.results)
  }

  if (results) {
    return (
      <Sheet title="Workout saved" onClose={onClose}>
        <div className="gym-results">
          {results.map(({ exercise: e, outcome: o }) => (
            <div key={e.id} className={'gym-result' + (o.levelUp ? ' up' : o.hit ? ' hit' : '')}>
              <strong>{e.name}</strong>
              {o.top == null ? (
                <span className="muted small">Not at {show(e.weight)} kg or heavier this time. Goal stays {goalText(e)}.</span>
              ) : o.levelUp ? (
                <span className="small">Strong! {o.top.reps} reps. Next goal: {goalText({ weight: o.weight, goal_reps: o.goal_reps })}.</span>
              ) : o.hit ? (
                <span className="small">Goal reached ({o.top.reps} reps). Next goal: {goalText({ weight: o.weight, goal_reps: o.goal_reps })}.</span>
              ) : (
                <span className="small">You did {o.top.reps}. The goal stays {goalText(e)}, you will get it next time.</span>
              )}
            </div>
          ))}
        </div>
        <div className="sheet-actions">
          <button className="btn primary grow" onClick={onClose}>
            <IconCheck size={18} /> Done
          </button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title={split.name} onClose={onClose}>
      {exercises.length === 0 && <p className="muted small">This day has no exercises yet. Open it from the list and add some.</p>}
      <label className="field">
        <span>Day</span>
        <input type="date" value={day} max={todayStr()} onChange={(e) => e.target.value && setDay(e.target.value)} />
      </label>
      {exercises.map((e) => (
        <div key={e.id} className="gym-log">
          <div className="gym-log-head">
            <strong>{e.name}</strong>
            <span className="gym-goal">Goal: {goalText(e)}</span>
          </div>
          {lastTime(e.id) && <span className="muted small">Last time: {lastTime(e.id)}</span>}
          {(rows[e.id] ?? []).map((r, i) => (
            <div key={i} className="gym-set">
              <span className="muted small">Set {i + 1}</span>
              <input type="text" inputMode="decimal" autoComplete="off" aria-label={`Set ${i + 1} weight in kg`} value={r.weight} placeholder="kg" onChange={(ev) => setRow(e.id, i, { weight: ev.target.value.replace(/[^0-9.,]/g, '').slice(0, 7) })} />
              <span className="muted">×</span>
              <input type="text" inputMode="numeric" autoComplete="off" aria-label={`Set ${i + 1} reps`} value={r.reps} placeholder={String(e.goal_reps)} onChange={(ev) => setRow(e.id, i, { reps: ev.target.value.replace(/\D/g, '').slice(0, 3) })} />
              <span className="muted small">reps</span>
            </div>
          ))}
          <button className="btn soft small-btn" onClick={() => setRows((x) => ({ ...x, [e.id]: [...x[e.id], { weight: x[e.id][x[e.id].length - 1]?.weight ?? '', reps: '' }] }))}>
            <IconPlus size={16} /> Add a set
          </button>
        </div>
      ))}
      {err && <p className="error">{err}</p>}
      <div className="sheet-actions">
        <button className="btn primary grow" onClick={() => void finish()} disabled={busy || exercises.length === 0}>
          {busy ? 'Saving…' : 'Finish workout'}
        </button>
      </div>
    </Sheet>
  )
}

// ======================= planning the split across the weeks =======================
export function PlanSheet({ splits, onClose }: { splits: GymSplit[]; onClose: () => void }) {
  const { session, profile, googleConnected, members } = useAuth()
  const { tasks, deleteTask } = useTasksCtx()
  const uid = session?.user.id ?? ''
  const today = todayStr()
  const settings = useGymSettings().find((s) => s.user_id === uid)
  const sessions = useGymSessions()
  const exercises = useGymExercises()
  const [perWeek, setPerWeek] = useState(settings?.per_week ?? Math.min(7, Math.max(1, splits.length)))
  const [days, setDays] = useState<number[]>(settings?.days ?? [])
  const [tod, setTod] = useState<TimeOfDay | 'exact'>(settings?.start_at ? 'exact' : settings?.time_of_day ?? 'any')
  const [startAt, setStartAt] = useState(settings?.start_at ?? '18:00') // used when "At a set time" is chosen
  const startMin = /^\d\d:\d\d$/.test(startAt) ? Number(startAt.slice(0, 2)) * 60 + Number(startAt.slice(3, 5)) : null
  const [hours, setHours] = useState(show((settings?.minutes ?? 60) / 60))
  const wd = (parseDateStr(today).getDay() + 6) % 7 // 0 = Monday
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(addDays(today, 6 - wd))
  const [replan, setReplan] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const minutes = Math.round(toNum(hours) * 60)
  const okMinutes = minutes >= 15 && minutes <= 300

  const dayList = useMemo(() => {
    const out: string[] = []
    for (let d = from; d <= to && out.length < 62; d = addDays(d, 1)) out.push(d)
    return out
  }, [from, to])
  const mySessions = useMemo(() => sessions.filter((s) => s.created_by === uid), [sessions, uid])
  const byTask = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  // sessions in the period that are still to do (these are the ones "replace" takes out)
  const replaceable = useMemo(() => mySessions.filter((s) => s.day >= (from > today ? from : today) && s.day <= to && !s.done && !(s.task_id && byTask.get(s.task_id)?.completed)), [mySessions, from, to, today, byTask])
  const ignore = useMemo(() => new Set(replan ? replaceable.flatMap((s) => (s.task_id ? [s.task_id] : [])) : []), [replan, replaceable])
  const busyAt = useBusy(from, to, ignore)

  const skip = skippedDays('gym', uid) // read fresh on every render
  const { sessions: plan, missing } = useMemo(() => {
    const kept = mySessions.filter((s) => !(replan && replaceable.some((r) => r.id === s.id)))
    // the rotation goes on after the last session you already have
    const sortedKept = [...kept].sort((a, b) => a.day.localeCompare(b.day))
    const last = sortedKept[sortedKept.length - 1]
    const lastIdx = last ? splits.findIndex((s) => s.id === last.split_id) : -1
    const now = new Date()
    return planGym({
      splits: splits.map((s) => ({ id: s.id, name: s.name })),
      startIndex: lastIdx >= 0 ? lastIdx + 1 : settings?.next_index ?? 0,
      from,
      to,
      perWeek,
      minutes: okMinutes ? minutes : 60,
      days,
      timeOfDay: tod === 'exact' ? 'any' : tod,
      startAt: tod === 'exact' ? startMin : null,
      skip,
      have: kept.map((s) => s.day),
      today,
      nowMin: now.getHours() * 60 + now.getMinutes(),
      busy: busyAt,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splits, mySessions, replan, replaceable, from, to, perWeek, minutes, okMinutes, days, tod, startMin, skip.join(','), busyAt, today])

  async function confirm() {
    if (!profile || !plan.length) return
    setBusy(true)
    setErr('')
    await saveSettings(profile.household_id, uid, { per_week: perWeek, days, time_of_day: tod === 'exact' ? 'any' : tod, start_at: tod === 'exact' ? startAt : null, minutes: okMinutes ? minutes : 60 })
    if (replan) {
      for (const s of replaceable) {
        const t = s.task_id ? byTask.get(s.task_id) : undefined
        if (t) await deleteTask(t.id)
      }
      await removeSessions(replaceable.map((s) => s.id))
    }
    const color = assigneeColor(uid, members, uid)
    const rows = plan.map((p) => {
      const lines = exercises
        .filter((e) => e.split_id === p.splitId)
        .sort((a, b) => a.position - b.position)
        .map((e) => `${e.name}: ${e.sets} × ${goalText(e)}`)
      return {
        household_id: profile.household_id,
        created_by: uid,
        assigned_to: uid,
        title: `Gym · ${p.name}`,
        notes: (lines.length ? lines.join('\n') + '\n' : '') + '(Planned by Muna)',
        due_date: p.date,
        start_time: fmtMin(p.start) + ':00',
        end_time: fmtMin(p.end) + ':00',
        icon: splits.find((x) => x.id === p.splitId)?.icon ?? 'IconBarbellFilled',
        color,
      }
    })
    const { data, error } = await supabase.from('tasks').insert(rows).select('id, due_date, start_time')
    if (error) {
      setBusy(false)
      return setErr(error.message)
    }
    const idOf = new Map((data ?? []).map((r) => [`${r.due_date}|${String(r.start_time).slice(0, 5)}`, r.id as string]))
    const e2 = await addSessions(plan.map((p) => ({ household_id: profile.household_id, created_by: uid, split_id: p.splitId, task_id: idOf.get(`${p.date}|${fmtMin(p.start)}`) ?? null, day: p.date })))
    notifyTasksChanged()
    if (googleConnected && idOf.size) void syncTasksToGoogle([...idOf.values()]).then(() => notifyTasksChanged())
    setBusy(false)
    if (e2) setErr(e2)
    else onClose()
  }

  const byDay = useMemo(() => {
    const m = new Map<string, typeof plan>()
    for (const p of plan) m.set(p.date, [...(m.get(p.date) ?? []), p])
    return [...m.entries()]
  }, [plan])
  const setRange = (weeks: number, startNext: boolean) => {
    const mon = addDays(today, -wd)
    const s = startNext ? addDays(mon, 7) : today
    setFrom(s)
    setTo(addDays(startNext ? addDays(mon, 7) : mon, weeks * 7 - 1))
  }

  return (
    <Sheet title="Plan my week" onClose={onClose}>
      <div className="field">
        <span>Which days</span>
        <div className="ml-slotline">
          <button type="button" className="ml-toggle" onClick={() => setRange(1, false)}>This week</button>
          <button type="button" className="ml-toggle" onClick={() => setRange(1, true)}>Next week</button>
          <button type="button" className="ml-toggle" onClick={() => setRange(2, false)}>2 weeks</button>
        </div>
      </div>
      <div className="row-2">
        <label className="field">
          <span>From</span>
          <input type="date" value={from} min={today} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </label>
        <label className="field">
          <span>Until (including)</span>
          <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </label>
      </div>
      <div className="field">
        <span>Sessions a week</span>
        <div className="ml-slotline">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button key={n} type="button" className={'ml-toggle' + (perWeek === n ? ' on' : '')} onClick={() => setPerWeek(n)} aria-pressed={perWeek === n}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Days you prefer (Muna picks from these first)</span>
        <div className="ml-slotline">
          {DAY_NAMES.map((n, i) => (
            <button key={n} type="button" className={'ml-toggle' + (days.includes(i) ? ' on' : '')} onClick={() => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort()))} aria-pressed={days.includes(i)}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="row-2">
        <div className="field">
          <span>Time of day</span>
          <select value={tod} onChange={(e) => setTod(e.target.value as typeof tod)}>
            {TIMES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
            <option value="exact">At a set time</option>
          </select>
        </div>
        <label className="field">
          <span>One session (hours)</span>
          <input type="text" inputMode="decimal" autoComplete="off" value={hours} onChange={(e) => setHours(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 5))} />
        </label>
      </div>
      {tod === 'exact' && (
        <label className="field">
          <span>Start time</span>
          <input type="time" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          <small className="muted">Every session starts then. If something is already in your calendar at that time, Muna moves it as little as possible.</small>
        </label>
      )}
      <SkipDays area="gym" days={dayList.filter((d) => d >= today)} title="Skip these days" />
      {replaceable.length > 0 && (
        <label className="check-row">
          <input type="checkbox" checked={replan} onChange={(e) => setReplan(e.target.checked)} />
          <span className="small">Also move the {replaceable.length} session{replaceable.length === 1 ? '' : 's'} already planned in these days</span>
        </label>
      )}
      {from > to && <p className="error">The last day is before the first day.</p>}
      {!okMinutes && <p className="error">A session lasts between 15 minutes (0.25) and 5 hours.</p>}
      {splits.length === 0 && <p className="muted small">Add your training days first (Push, Pull, Legs…).</p>}
      {plan.length > 0 && (
        <div className="uni-plan">
          <p className="small">
            <strong>{plan.length}</strong> session{plan.length === 1 ? '' : 's'}, in this order: {[...new Set(plan.map((p) => p.name))].join(' → ')}.
          </p>
          {byDay.map(([d, ps]) => (
            <div key={d} className="uni-day">
              <strong>{niceDay(d)}</strong>
              {ps.map((p) => (
                <div key={p.start} className="uni-block">
                  <span className="muted small">
                    {fmtMin(p.start)}–{fmtMin(p.end)}
                  </span>
                  <span>{p.name}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {plan.length === 0 && splits.length > 0 && from <= to && <p className="muted small">Nothing to add: these days are full, skipped, or already planned.</p>}
      {missing > 0 && plan.length > 0 && <p className="wx-warn">{missing} session{missing === 1 ? '' : 's'} did not fit. Add more days, or skip fewer.</p>}
      {err && <p className="error">{err}</p>}
      <div className="sheet-actions">
        <button className="btn primary grow" onClick={() => void confirm()} disabled={busy || !plan.length}>
          {busy ? 'Adding…' : plan.length ? 'Add to my calendar' : 'Nothing to add'}
        </button>
      </div>
    </Sheet>
  )
}

