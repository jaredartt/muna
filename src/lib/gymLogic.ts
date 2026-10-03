// Gym maths with NO imports (tested on its own): how the goal moves after a workout, estimated strength, and week/month comparisons.
// The rule of the app: the goal is always ONE MORE REP. Miss it and it stays. Reach it and it becomes one more.
// When you reach `max_reps` (11 by default) the goal becomes: one step heavier (1 kg by default), back at `start_reps`.

export type Target = { weight: number; goal_reps: number; start_reps: number; max_reps: number; step: number }
export type SetIn = { weight: number; reps: number }
export type Outcome = { weight: number; goal_reps: number; hit: boolean; levelUp: boolean; top: SetIn | null }

/** Round away floating point dust (0.1 + 0.2). */
const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * What the target becomes after a workout. Only sets at the target weight or heavier count.
 * The best of them (most reps, the heavier one when tied) is compared with the goal.
 */
export function afterWorkout(t: Target, sets: SetIn[]): Outcome {
  const counted = sets.filter((s) => s.reps > 0 && s.weight >= t.weight)
  if (!counted.length) return { weight: t.weight, goal_reps: t.goal_reps, hit: false, levelUp: false, top: null }
  const top = counted.reduce((a, b) => (b.reps > a.reps || (b.reps === a.reps && b.weight > a.weight) ? b : a))
  if (top.reps < t.goal_reps) return { weight: t.weight, goal_reps: t.goal_reps, hit: false, levelUp: false, top }
  if (top.reps >= t.max_reps) return { weight: r2(top.weight + t.step), goal_reps: t.start_reps, hit: true, levelUp: true, top }
  return { weight: top.weight, goal_reps: Math.min(t.max_reps, top.reps + 1), hit: true, levelUp: false, top }
}

/** Epley estimate of the heaviest single rep you could do. */
export const e1rm = (s: SetIn) => (s.weight <= 0 ? s.reps : r2(s.weight * (1 + s.reps / 30)))
export const volume = (sets: SetIn[]) => r2(sets.reduce((a, s) => a + s.weight * s.reps, 0))

export type DayLog = { day: string; sets: SetIn[] }
export type Point = { day: string; best: number; weight: number; reps: number; volume: number }

/** One point per training day: the best set (by estimated strength) and the total volume. */
export function pointsOf(logs: { day: string; weight: number; reps: number }[]): Point[] {
  const byDay = new Map<string, SetIn[]>()
  for (const l of logs) byDay.set(l.day, [...(byDay.get(l.day) ?? []), { weight: Number(l.weight), reps: l.reps }])
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, sets]) => {
      const top = sets.reduce((a, b) => (e1rm(b) > e1rm(a) ? b : a))
      return { day, best: e1rm(top), weight: top.weight, reps: top.reps, volume: volume(sets) }
    })
}

const addDay = (s: string, n: number) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
export const mondayOf = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return addDay(s, -((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7))
}

export type Compare = { now: Point | null; before: Point | null; diffBest: number | null; diffPct: number | null; diffVolumePct: number | null }

function bestIn(points: Point[], from: string, to: string): Point | null {
  const inside = points.filter((p) => p.day >= from && p.day <= to)
  if (!inside.length) return null
  const top = inside.reduce((a, b) => (b.best > a.best ? b : a))
  return { ...top, volume: r2(inside.reduce((a, p) => a + p.volume, 0)) }
}
function compare(now: Point | null, before: Point | null): Compare {
  if (!now || !before) return { now, before, diffBest: null, diffPct: null, diffVolumePct: null }
  return {
    now,
    before,
    diffBest: r2(now.best - before.best),
    diffPct: before.best > 0 ? Math.round(((now.best - before.best) / before.best) * 1000) / 10 : null,
    diffVolumePct: before.volume > 0 ? Math.round(((now.volume - before.volume) / before.volume) * 1000) / 10 : null,
  }
}

/** This week against last week (weeks start on Monday) and the last 30 days against the 30 days before. */
export function comparisons(points: Point[], today: string): { week: Compare; month: Compare } {
  const mon = mondayOf(today)
  const week = compare(bestIn(points, mon, addDay(mon, 6)), bestIn(points, addDay(mon, -7), addDay(mon, -1)))
  const month = compare(bestIn(points, addDay(today, -29), today), bestIn(points, addDay(today, -59), addDay(today, -30)))
  return { week, month }
}

/** The goal as a sentence: "60 kg x 9 reps". */
export const goalText = (t: Pick<Target, 'weight' | 'goal_reps'>) => (t.weight > 0 ? `${t.weight} kg × ${t.goal_reps}` : `${t.goal_reps} reps`)
