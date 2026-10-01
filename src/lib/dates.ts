export function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** Local date as YYYY-MM-DD (never use toISOString for this: it is UTC). */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayStr(): string {
  return toDateStr(new Date())
}

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number): string {
  const d = parseDateStr(s)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

export function formatTime(t: string | null): string {
  if (!t) return ''
  return t.slice(0, 5)
}

export function formatDateNice(s: string): string {
  const today = todayStr()
  if (s === today) return 'Today'
  if (s === addDays(today, 1)) return 'Tomorrow'
  if (s === addDays(today, -1)) return 'Yesterday'
  return parseDateStr(s).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export const WEEKDAYS_MON_FIRST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Cells for a month grid, Monday first. Null = empty cell. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(toDateStr(new Date(year, month, d)))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
