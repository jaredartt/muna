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

export const HOUR_H = 56 // pixels per hour in the day view
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

/** Side-by-side columns for items that overlap in time. Returns key -> { lane, lanes }. */
export function layoutLanes(items: DayItem[]): Map<string, { lane: number; lanes: number }> {
  const out = new Map<string, { lane: number; lanes: number }>()
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)
  let cluster: DayItem[] = []
  let clusterEnd = -1
  const flush = () => {
    const laneEnds: number[] = []
    const lane = new Map<string, number>()
    for (const it of cluster) {
      let i = laneEnds.findIndex((e) => e <= it.start)
      if (i < 0) {
        i = laneEnds.length
        laneEnds.push(0)
      }
      laneEnds[i] = it.end
      lane.set(it.key, i)
    }
    for (const it of cluster) out.set(it.key, { lane: lane.get(it.key)!, lanes: laneEnds.length })
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
