// Muna's weekly hobby planner. No imports on purpose (tested on its own). Times are minutes since midnight, dates YYYY-MM-DD.
// For each hobby she looks for the days of the week that have a free stretch long enough, and takes `perWeek` of them:
// preferred weekdays first, then days that are not next to another session, then the days with the most free time.
// A week with only one workable day simply gets that day (nothing to choose).

export type Span = { start: number; end: number }
export type TimeOfDay = 'any' | 'morning' | 'afternoon' | 'evening'
export type HobbyIn = {
  id: string
  name: string
  minutes: number // how long one session usually takes
  perWeek: number
  days: number[] // preferred weekdays, 0 = Monday ... 6 = Sunday
  timeOfDay: TimeOfDay
  have: string[] // days of this week that already have a session (they count towards perWeek)
}
export type Session = { hobbyId: string; date: string; start: number; end: number }
export type PlanInput = {
  hobbies: HobbyIn[]
  days: string[] // the days of the week still open to plan (today or later)
  today: string
  nowMin: number
  busy: (date: string) => Span[]
}
export type PlanResult = { sessions: Session[]; short: { hobbyId: string; missing: number }[] }

const STEP = 15
const GAP = 15
const WINDOWS: Record<TimeOfDay, { lo: number; hi: number; target: number }> = {
  any: { lo: 9 * 60, hi: 21 * 60, target: 18 * 60 },
  morning: { lo: 7 * 60, hi: 12 * 60, target: 9 * 60 + 30 },
  afternoon: { lo: 12 * 60, hi: 17 * 60 + 30, target: 15 * 60 },
  evening: { lo: 17 * 60, hi: 22 * 60, target: 19 * 60 },
}
const up = (n: number) => Math.ceil(n / STEP) * STEP
const down = (n: number) => Math.floor(n / STEP) * STEP

/** 0 = Monday ... 6 = Sunday */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}
export function addDay(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
/** The Monday of the week a date is in. */
export function mondayOf(date: string): string {
  return addDay(date, -weekdayOf(date))
}

function freeSpans(date: string, lo: number, hi: number, busy: Span[], i: Pick<PlanInput, 'today' | 'nowMin'>): Span[] {
  if (date < i.today) return []
  if (date === i.today) lo = Math.max(lo, up(i.nowMin + 30))
  let free: Span[] = [{ start: up(lo), end: down(hi) }]
  for (const b of [...busy].sort((a, c) => a.start - c.start)) {
    const cutS = b.start - GAP
    const cutE = b.end + GAP
    const next: Span[] = []
    for (const f of free) {
      if (cutE <= f.start || cutS >= f.end) next.push(f)
      else {
        if (cutS - f.start >= STEP) next.push({ start: f.start, end: down(cutS) })
        if (f.end - cutE >= STEP) next.push({ start: up(cutE), end: f.end })
      }
    }
    free = next
  }
  return free.filter((f) => f.end - f.start >= STEP)
}

/** The start time nearest to the usual time for this hobby, or null when nothing long enough is free. */
function bestSlot(h: HobbyIn, date: string, busy: Span[], i: Pick<PlanInput, 'today' | 'nowMin'>): { start: number; free: number } | null {
  const w = WINDOWS[h.timeOfDay]
  const spans = freeSpans(date, w.lo, w.hi, busy, i)
  const free = spans.reduce((a, s) => a + (s.end - s.start), 0)
  const want = w.target - h.minutes / 2
  let best: number | null = null
  for (const s of spans) {
    if (s.end - s.start < h.minutes) continue
    const lastStart = down(s.end - h.minutes)
    // the start inside this stretch that is nearest to the wanted time
    const start = Math.min(lastStart, Math.max(s.start, up(want)))
    const cands = [start, Math.max(s.start, down(want))].filter((c) => c >= s.start && c <= lastStart)
    for (const c of cands) if (best === null || Math.abs(c - want) < Math.abs(best - want)) best = c
  }
  return best === null ? null : { start: best, free }
}

export function planHobbies(i: PlanInput): PlanResult {
  const busy = new Map<string, Span[]>(i.days.map((d) => [d, [...i.busy(d)]]))
  const sessions: Session[] = []
  const used = new Map<string, Set<string>>() // hobby -> days it has (existing and new)
  const dayHas = new Map<string, number>() // day -> sessions of any hobby planned now
  for (const h of i.hobbies) used.set(h.id, new Set(h.have))

  const need = (h: HobbyIn) => Math.max(0, Math.min(7, h.perWeek) - h.have.length)
  const feasible = (h: HobbyIn) => i.days.filter((d) => !used.get(h.id)!.has(d) && bestSlot(h, d, busy.get(d) ?? [], i))
  // the hobbies with the fewest workable days go first, so they are not squeezed out
  const order = i.hobbies.filter((h) => need(h) > 0).sort((a, b) => feasible(a).length / need(a) - feasible(b).length / need(b))
  const short: PlanResult['short'] = []

  for (const h of order) {
    let missing = need(h)
    while (missing > 0) {
      const mine = used.get(h.id)!
      const cands = i.days
        .filter((d) => !mine.has(d))
        .map((d) => ({ d, slot: bestSlot(h, d, busy.get(d) ?? [], i) }))
        .filter((c): c is { d: string; slot: { start: number; free: number } } => c.slot !== null)
      if (!cands.length) break
      const score = (c: (typeof cands)[number]) => {
        const wd = weekdayOf(c.d)
        let s = h.days.includes(wd) ? 0 : 10 // the days you prefer win
        const near = [...mine].some((m) => Math.abs((Date.parse(m) - Date.parse(c.d)) / 86400000) === 1)
        if (near && h.perWeek > 1) s += 3 // spread several sessions over the week
        s += (dayHas.get(c.d) ?? 0) * 2 // do not stack hobbies on one day when another day works
        return s
      }
      cands.sort((a, b) => score(a) - score(b) || b.slot.free - a.slot.free || a.d.localeCompare(b.d))
      const pick = cands[0]
      const end = pick.slot.start + h.minutes
      sessions.push({ hobbyId: h.id, date: pick.d, start: pick.slot.start, end })
      busy.get(pick.d)!.push({ start: pick.slot.start, end })
      mine.add(pick.d)
      dayHas.set(pick.d, (dayHas.get(pick.d) ?? 0) + 1)
      missing--
    }
    if (missing > 0) short.push({ hobbyId: h.id, missing })
  }
  sessions.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
  return { sessions, short }
}
