// What the day and week views draw: one small description per task or Google event, so the views know nothing about either.
export type DayItem = {
  key: string
  kind: 'task' | 'event'
  title: string
  color: string
  icon: string
  done: boolean
  allDay: boolean // no time frame: shown in the all-day strip
  start: number // minutes after midnight (timed items)
  end: number
  movable: boolean
  open: () => void
  toggle: () => void // tick done / not done
}

// Pixels per hour in the day view. A quarter of an hour is 28 px: exactly one line of text (13 px font), so four 15-minute items
// fit in one hour and a 15-minute item is half as tall as a 30-minute one, at the same font size.
export const HOUR_H = 112
export const TOP_PAD = 16 // breathing space above the first hour line (the grid has the same space below the last one)
export const SNAP = 15 // minutes
export const DAY_START = 360 // the day view and week view show 06:00 ...
export const DAY_END = 1440 // ... until 00:00
export const HOURS_SHOWN = (DAY_END - DAY_START) / 60 // 18
/** Pixels from the top of the grid for a time (times before 06:00 are drawn at the top edge). */
export const yOf = (min: number, perHour: number) => ((Math.max(min, DAY_START) - DAY_START) / 60) * perHour

export const pad2 = (n: number) => String(n).padStart(2, '0')
export const fmtMin = (m: number) => (m >= 1440 ? '24:00' : `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`)
export const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
export const hhmmss = (m: number) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}:00`

// Which side a colour sits on when items overlap: the same colour is always in the same place (orange first, purple last).
const COLOR_ORDER = ['peach', 'mint', 'sky', 'butter', 'coral', 'rose', 'lilac']
const colorRank = (c: string) => {
  const i = COLOR_ORDER.indexOf(c)
  return i < 0 ? COLOR_ORDER.length : i
}

/**
 * Side-by-side columns for items that overlap in time. Returns key -> { lane, lanes }.
 * Items that overlap nothing are alone (full width). In a group of overlapping items every colour keeps its own column(s), in the same
 * order each time, so e.g. orange tasks are always on the left and purple ones on the right.
 */
export function layoutLanes(items: DayItem[]): Map<string, { lane: number; lanes: number }> {
  const out = new Map<string, { lane: number; lanes: number }>()
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)
  let cluster: DayItem[] = []
  let clusterEnd = -1
  const flush = () => {
    const colors = [...new Set(cluster.map((i) => i.color))].sort((a, b) => colorRank(a) - colorRank(b) || a.localeCompare(b))
    const lane = new Map<string, number>()
    let offset = 0
    for (const c of colors) {
      // inside one colour, items that overlap each other still need their own column
      const laneEnds: number[] = []
      for (const it of cluster.filter((i) => i.color === c)) {
        let i = laneEnds.findIndex((e) => e <= it.start)
        if (i < 0) {
          i = laneEnds.length
          laneEnds.push(0)
        }
        laneEnds[i] = it.end
        lane.set(it.key, offset + i)
      }
      offset += laneEnds.length
    }
    for (const it of cluster) out.set(it.key, { lane: lane.get(it.key)!, lanes: offset })
    cluster = []
  }
  for (const it of sorted) {
    if (cluster.length && it.start >= clusterEnd) flush()
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.end)
    if (cluster.length === 1) clusterEnd = it.end
  }
  if (cluster.length) flush()
  return out
}
