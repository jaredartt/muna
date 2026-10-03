import { useMemo, useState } from 'react'
import { IconBarbell, IconChevronLeft, IconChevronRight, IconPlus, IconX } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import { useTasksCtx } from '../context/TasksContext'
import { useConfirm } from '../components/Confirm'
import LineChart from '../components/LineChart'
import { PlanSheet, SplitSheet, WorkoutSheet } from '../components/GymSheets'
import { dayWord } from '../components/HobbiesCard'
import { useReorder } from '../hooks/useReorder'
import { navigate } from '../lib/router'
import { parseDateStr, todayStr } from '../lib/dates'
import { addSplit, deleteDayLogs, reorderSplits, upcomingSessions, useGymExercises, useGymLogs, useGymSessions, useGymSettings, useGymSplits, type GymSplit } from '../lib/gym'
import { comparisons, goalText, pointsOf, type Compare } from '../lib/gymLogic'

const PRESETS: { label: string; days: string[] }[] = [
  { label: 'Push · Pull · Legs', days: ['Push', 'Pull', 'Legs'] },
  { label: 'Upper · Lower', days: ['Upper', 'Lower'] },
  { label: 'Full body A · B', days: ['Full body A', 'Full body B'] },
]
const short = (d: string) => parseDateStr(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const kg = (n: number) => `${Math.round(n * 10) / 10} kg`
const sign = (n: number) => (n > 0 ? '+' : '') + n

function CompareLine({ title, c }: { title: string; c: Compare }) {
  if (!c.now) return (
    <div className="gym-cmp">
      <span className="muted small">{title}</span>
      <span className="muted small">Nothing logged</span>
    </div>
  )
  return (
    <div className="gym-cmp">
      <span className="muted small">{title}</span>
      <strong>{kg(c.now.best)}</strong>
      {c.before ? (
        <span className={'small ' + ((c.diffBest ?? 0) >= 0 ? 'ok' : 'warn-text')}>
          {sign(c.diffBest ?? 0)} kg{c.diffPct != null ? ` (${sign(c.diffPct)}%)` : ''} vs before · volume {c.diffVolumePct != null ? sign(c.diffVolumePct) + '%' : '–'}
        </span>
      ) : (
        <span className="muted small">Nothing before to compare with</span>
      )}
    </div>
  )
}

export default function Gym() {
  const { session, profile } = useAuth()
  const { tasks } = useTasksCtx()
  const { confirm } = useConfirm()
  const uid = session?.user.id ?? ''
  const today = todayStr()
  const allSplits = useGymSplits()
  const allEx = useGymExercises()
  const allLogs = useGymLogs()
  useGymSessions()
  const settings = useGymSettings().find((s) => s.user_id === uid)
  const splits = useMemo(() => allSplits.filter((s) => s.created_by === uid).sort((a, b) => a.position - b.position), [allSplits, uid])
  const exercises = useMemo(() => allEx.filter((e) => e.created_by === uid), [allEx, uid])
  const logs = useMemo(() => allLogs.filter((l) => l.created_by === uid), [allLogs, uid])
  const upcoming = upcomingSessions(uid, tasks, today)
  const exOf = (splitId: string) => exercises.filter((e) => e.split_id === splitId).sort((a, b) => a.position - b.position)

  const [editing, setEditing] = useState<GymSplit | 'new' | null>(null)
  const [workout, setWorkout] = useState<{ split: GymSplit; session: (typeof upcoming)[number]['session'] | null; task: (typeof upcoming)[number]['task'] } | null>(null)
  const [planning, setPlanning] = useState(false)
  const [progressId, setProgressId] = useState('')
  const [metric, setMetric] = useState<'best' | 'volume'>('best')
  const [busy, setBusy] = useState(false)

  const sp = useReorder({ columns: [splits.map((s) => s.id)], onChange: (c) => void reorderSplits(c[0]), enabled: editing === null && !workout && !planning })

  // the next day in the rotation when nothing is planned: the one after the last one you trained
  const nextByRotation = useMemo(() => {
    if (!splits.length) return null
    const byDay = [...logs].sort((a, b) => a.day.localeCompare(b.day))
    const lastLog = byDay[byDay.length - 1]
    const lastEx = lastLog ? exercises.find((e) => e.id === lastLog.exercise_id) : null
    const i = lastEx ? splits.findIndex((s) => s.id === lastEx.split_id) : -1
    return splits[(i + 1) % splits.length]
  }, [splits, logs, exercises])

  const next = upcoming[0]
  const nextSplit = next?.split ?? nextByRotation
  const nextEx = nextSplit ? exOf(nextSplit.id) : []

  // ---- progress ----
  const withLogs = exercises.filter((e) => logs.some((l) => l.exercise_id === e.id))
  const chosen = exercises.find((e) => e.id === progressId) ?? withLogs[0] ?? null
  const points = useMemo(() => (chosen ? pointsOf(logs.filter((l) => l.exercise_id === chosen.id)) : []), [chosen, logs])
  const cmp = useMemo(() => comparisons(points, today), [points, today])
  const chart = points.slice(-20).map((p) => ({ label: short(p.day), value: metric === 'best' ? p.best : p.volume }))

  // ---- history (by day) ----
  const history = useMemo(() => {
    const days = new Map<string, { exIds: Set<string>; sets: number }>()
    for (const l of logs) {
      const d = days.get(l.day) ?? { exIds: new Set<string>(), sets: 0 }
      d.exIds.add(l.exercise_id)
      d.sets++
      days.set(l.day, d)
    }
    return [...days.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 8)
  }, [logs])

  async function quickAdd(days: string[]) {
    if (!profile) return
    setBusy(true)
    for (const name of days) await addSplit(profile.household_id, uid, name)
    setBusy(false)
  }

  if (!profile) return null
  return (
    <div className="page gym-page">
      <header className="page-head">
        <div className="updates-title">
          <button className="icon-btn" onClick={() => navigate('/')} aria-label="Back to Home">
            <IconChevronLeft size={24} />
          </button>
          <h1>Gym</h1>
        </div>
      </header>

      {/* ---- next session ---- */}
      <section className="card gym-card">
        <h3>{next ? 'Up next' : 'Your next workout'}</h3>
        {splits.length === 0 ? (
          <>
            <p className="muted small">Start by adding the days of your split. Pick a ready-made one (you can change everything later) or add your own below.</p>
            <div className="ml-slotline">
              {PRESETS.map((p) => (
                <button key={p.label} className="ml-toggle" disabled={busy} onClick={() => void quickAdd(p.days)}>
                  {p.label}
                </button>
              ))}
            </div>
          </>
        ) : nextSplit ? (
          <>
            <div className="gym-next">
              <strong className="gym-next-name">{nextSplit.name}</strong>
              <span className="muted small">{next ? `${dayWord(next.session.day, today)}${next.task?.start_time ? ' · ' + next.task.start_time.slice(0, 5) : ''}` : 'Not planned yet'}</span>
            </div>
            {nextEx.length === 0 ? (
              <p className="muted small">No exercises yet. Open this day below and add some.</p>
            ) : (
              <div className="gym-goals">
                <span className="muted small">Goals for this session (one more rep each time)</span>
                {nextEx.map((e) => (
                  <div key={e.id} className="gym-goal-row">
                    <span>{e.name}</span>
                    <strong>{goalText(e)}</strong>
                  </div>
                ))}
              </div>
            )}
            <div className="sheet-actions">
              <button className="btn primary grow" onClick={() => setWorkout({ split: nextSplit, session: next?.session ?? null, task: next?.task ?? null })} disabled={nextEx.length === 0}>
                <IconBarbell size={20} /> Start workout
              </button>
              <button className="btn soft" onClick={() => setPlanning(true)}>
                Plan
              </button>
            </div>
          </>
        ) : null}
      </section>

      {/* ---- coming sessions ---- */}
      {upcoming.length > 0 && (
        <section className="card">
          <h3>Coming up</h3>
          {upcoming.slice(0, 6).map((u) => (
            <button key={u.session.id} className="ml-row" onClick={() => setWorkout({ split: u.split, session: u.session, task: u.task })}>
              <span className="ml-row-main">
                <strong>{u.split.name}</strong>
                <span className="muted small">
                  {dayWord(u.session.day, today)}
                  {u.task?.start_time ? ` · ${u.task.start_time.slice(0, 5)}` : ''}
                </span>
              </span>
              <IconChevronRight size={20} />
            </button>
          ))}
        </section>
      )}

      {/* ---- the split ---- */}
      <section className="card">
        <h3>My split</h3>
        {splits.length > 1 && <p className="muted small">Muna follows this order. Press and hold a day to move it.</p>}
        <div className="gym-split-list" ref={sp.column(0)}>
          {splits.map((s, i) => (
            <div key={s.id} {...sp.item(s.id)}>
              <button className="ml-row gym-split-row" onClick={() => setEditing(s)}>
                <span className="gym-num">{i + 1}</span>
                <span className="ml-row-main">
                  <strong>{s.name}</strong>
                  <span className="muted small">{exOf(s.id).length} exercise{exOf(s.id).length === 1 ? '' : 's'}</span>
                </span>
                <IconChevronRight size={20} />
              </button>
            </div>
          ))}
        </div>
        <button className="btn primary" onClick={() => setEditing('new')}>
          <IconPlus size={18} /> Add a training day
        </button>
        {splits.length > 0 && (
          <button className="btn soft" onClick={() => setPlanning(true)}>
            Plan my week with Muna
          </button>
        )}
        {settings && splits.length > 0 && <p className="muted small">{settings.per_week} session{settings.per_week === 1 ? '' : 's'} a week · {Math.round((settings.minutes / 60) * 100) / 100} h each</p>}
      </section>

      {/* ---- progress ---- */}
      <section className="card">
        <h3>Progress</h3>
        {!chosen ? (
          <p className="muted small">Finish a workout and your progress shows up here: strength over time, and how this week and this month compare with before.</p>
        ) : (
          <>
            <label className="field">
              <span>Exercise</span>
              <select value={chosen.id} onChange={(e) => setProgressId(e.target.value)}>
                {withLogs.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="gym-now">
              <span className="muted small">Goal now</span>
              <strong>{goalText(chosen)}</strong>
            </div>
            <div className="ml-slotline">
              <button className={'ml-toggle' + (metric === 'best' ? ' on' : '')} onClick={() => setMetric('best')}>
                Strength
              </button>
              <button className={'ml-toggle' + (metric === 'volume' ? ' on' : '')} onClick={() => setMetric('volume')}>
                Volume
              </button>
            </div>
            <LineChart points={chart} unit={metric === 'best' ? ' kg' : ''} />
            <p className="muted small">{metric === 'best' ? 'Strength = your best set of each day, as the heaviest single rep it points to (estimated).' : 'Volume = weight × reps added up over all sets of that day.'}</p>
            <CompareLine title="This week" c={cmp.week} />
            <CompareLine title="Last 30 days" c={cmp.month} />
            {points.length > 0 && (
              <div className="gym-pr">
                <span className="muted small">Best ever</span>
                <strong>{kg(Math.max(...points.map((p) => p.best)))}</strong>
                <span className="muted small">{points.length} workout{points.length === 1 ? '' : 's'} logged</span>
              </div>
            )}
          </>
        )}
      </section>

      {/* ---- history ---- */}
      {history.length > 0 && (
        <section className="card">
          <h3>History</h3>
          {history.map(([day, h]) => (
            <div key={day} className="ml-row gym-hist">
              <span className="ml-row-main">
                <strong>{dayWord(day, today)}</strong>
                <span className="muted small">
                  {h.exIds.size} exercise{h.exIds.size === 1 ? '' : 's'} · {h.sets} set{h.sets === 1 ? '' : 's'}
                </span>
              </span>
              <button
                className="icon-btn"
                aria-label={`Delete the workout of ${day}`}
                onClick={async () => {
                  if (await confirm({ message: <>Delete the workout of <strong>{dayWord(day, today)}</strong>? The goals do not go back.</> })) for (const id of h.exIds) await deleteDayLogs(id, day)
                }}
              >
                <IconX size={18} />
              </button>
            </div>
          ))}
        </section>
      )}

      {editing && <SplitSheet key={editing === 'new' ? 'new' : editing.id} split={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {workout && <WorkoutSheet key={workout.split.id + (workout.session?.id ?? '')} split={workout.split} session={workout.session} task={workout.task} onClose={() => setWorkout(null)} />}
      {planning && <PlanSheet splits={splits} onClose={() => setPlanning(false)} />}
    </div>
  )
}

