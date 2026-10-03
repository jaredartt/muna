// Muna's gym planner: spreads your split over the weeks you choose. Imports only the hobby planner (same free-time logic), so it can be tested on its own.
// Rotation: the sessions of a week take the splits in order (Push, Pull, Legs, Push, ...) continuing where the last plan stopped.
import { addDay, mondayOf, planHobbies, type Span, type TimeOfDay } from './hobbyPlan'

export type GymSplitIn = { id: string; name: string }
export type GymSession = { splitId: string; name: string; date: string; start: number; end: number }
export type GymPlanInput = {
  splits: GymSplitIn[] // in rotation order
  startIndex: number // which split comes first
  from: string
  to: string
  perWeek: number
  minutes: number
  days: number[] // preferred weekdays, 0 = Monday ... 6 = Sunday
  timeOfDay: TimeOfDay
  startAt?: number | null // a fixed start time in minutes since midnight (then timeOfDay is ignored)
  skip: string[] // days you do not want anything planned on
  have: string[] // days that already have a gym session (they count towards perWeek, and are not used again)
  today: string
  nowMin: number
  busy: (date: string) => Span[]
}
export type GymPlanResult = { sessions: GymSession[]; missing: number; nextIndex: number }

export function planGym(i: GymPlanInput): GymPlanResult {
  if (!i.splits.length || i.from > i.to) return { sessions: [], missing: 0, nextIndex: i.startIndex }
  const raw: { date: string; start: number; end: number }[] = []
  let missing = 0
  // week by week (Monday to Sunday), only the days inside from..to that are still ahead and not skipped
  for (let mon = mondayOf(i.from); mon <= i.to; mon = addDay(mon, 7)) {
    const days: string[] = []
    for (let k = 0; k < 7; k++) {
      const d = addDay(mon, k)
      if (d >= i.from && d <= i.to && d >= i.today && !i.skip.includes(d)) days.push(d)
    }
    const have = i.have.filter((d) => d >= mon && d <= addDay(mon, 6))
    if (!days.length) continue
    const res = planHobbies({
      hobbies: [{ id: 'gym', name: 'Gym', minutes: i.minutes, perWeek: i.perWeek, days: i.days, timeOfDay: i.timeOfDay, startAt: i.startAt ?? null, have }],
      days: days.filter((d) => !have.includes(d)),
      today: i.today,
      nowMin: i.nowMin,
      busy: i.busy,
    })
    for (const s of res.sessions) raw.push({ date: s.date, start: s.start, end: s.end })
    missing += res.short.reduce((a, s) => a + s.missing, 0)
  }
  raw.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
  let idx = ((i.startIndex % i.splits.length) + i.splits.length) % i.splits.length
  const sessions = raw.map((r) => {
    const sp = i.splits[idx]
    idx = (idx + 1) % i.splits.length
    return { splitId: sp.id, name: sp.name, ...r }
  })
  return { sessions, missing, nextIndex: idx }
}
