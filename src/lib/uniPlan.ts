// Muna's study planner: puts the time you plan for each Uni item into the free hours of the days you choose.
// No imports on purpose, so it can be tested on its own. Times are minutes since midnight, dates are YYYY-MM-DD.

export type Span = { start: number; end: number }
export type PlanItem = { id: string; title: string; minutes: number }
export type Block = { itemId: string; title: string; date: string; start: number; end: number; part: number; parts: number }
export type PlanInput = {
  items: PlanItem[] // in the order they should be studied (earlier weeks first)
  from: string
  to: string
  winStart: number // study only between these two times each day
  winEnd: number
  today: string
  nowMin: number // minutes since midnight now (today is only planned after this)
  busy: (date: string) => Span[] // what is already in your day
}
export type PlanResult = { blocks: Block[]; left: { itemId: string; title: string; minutes: number }[]; usedDays: number }

export const STEP = 15
export const MAX_BLOCK = 120 // one sitting is never longer than this
export const MIN_BLOCK = 30 // and never shorter, unless that is all that is left of the item
export const BREAK = 15 // gap before and after other things, and between two blocks

const up = (n: number) => Math.ceil(n / STEP) * STEP
const down = (n: number) => Math.floor(n / STEP) * STEP

function addDay(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string, cap = 62): string[] {
  const out: string[] = []
  for (let d = from; d <= to && out.length < cap; d = addDay(d, 1)) out.push(d)
  return out
}

/** The free stretches of one day inside the study hours, keeping a gap around everything already planned. */
function freeSpans(date: string, i: PlanInput): Span[] {
  if (date < i.today) return []
  let lo = i.winStart
  if (date === i.today) lo = Math.max(lo, up(i.nowMin + 10))
  let free: Span[] = [{ start: up(lo), end: down(i.winEnd) }]
  for (const b of i.busy(date).sort((a, c) => a.start - c.start)) {
    const cutS = b.start - BREAK
    const cutE = b.end + BREAK
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

export function planStudy(i: PlanInput): PlanResult {
  const days = daysBetween(i.from, i.to)
  const free = new Map<string, Span[]>(days.map((d) => [d, freeSpans(d, i)]))
  const cap = (d: string) => (free.get(d) ?? []).reduce((a, f) => a + (f.end - f.start), 0)
  const remaining = i.items.filter((x) => x.minutes > 0).map((x) => ({ ...x, minutes: up(x.minutes), parts: [] as { date: string; start: number; end: number }[] }))
  const total = () => remaining.reduce((a, r) => a + r.minutes, 0)

  // puts up to `budget` minutes into one day, item after item, earliest free time first
  function fillDay(d: string, budget: number) {
    const spans = free.get(d) ?? []
    let used = 0
    for (const r of remaining) {
      while (r.minutes > 0 && used < budget) {
        const s = spans.find((f) => f.end - f.start >= Math.min(MIN_BLOCK, r.minutes))
        if (!s) return
        const room = s.end - s.start
        let len = Math.min(r.minutes, MAX_BLOCK, room, budget - used)
        // do not leave a tiny stub of the item behind
        if (r.minutes - len > 0 && r.minutes - len < MIN_BLOCK && len > MIN_BLOCK) len = Math.max(MIN_BLOCK, r.minutes - MIN_BLOCK)
        len = down(len)
        if (len < Math.min(STEP, r.minutes)) return
        r.parts.push({ date: d, start: s.start, end: s.start + len })
        r.minutes -= len
        used += len
        s.start += len + BREAK
        if (s.end - s.start < STEP) spans.splice(spans.indexOf(s), 1)
      }
      if (used >= budget) return
    }
  }

  // Pass 1: spread the work over the days (a day takes its fair share, more if later days cannot take it).
  for (let k = 0; k < days.length; k++) {
    const d = days[k]
    const left = total()
    if (left <= 0) break
    const later = days.slice(k + 1).reduce((a, x) => a + Math.floor(cap(x) * 0.85), 0)
    const share = up(left / (days.length - k))
    const need = Math.max(share, left - later)
    fillDay(d, Math.min(need, cap(d)))
  }
  // Pass 2: whatever is left goes into any free time that remains.
  if (total() > 0) for (const d of days) fillDay(d, Infinity)

  const blocks: Block[] = []
  for (const r of remaining) {
    const parts = r.parts.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
    parts.forEach((p, n) => blocks.push({ itemId: r.id, title: r.title, date: p.date, start: p.start, end: p.end, part: n + 1, parts: parts.length }))
  }
  blocks.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
  return {
    blocks,
    left: remaining.filter((r) => r.minutes > 0).map((r) => ({ itemId: r.id, title: r.title, minutes: r.minutes })),
    usedDays: new Set(blocks.map((b) => b.date)).size,
  }
}
