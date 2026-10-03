// Repeating tasks. This file has NO imports on purpose: an identical copy lives next to the server code
// (supabase/functions/*/recurrence.ts), so keep the two in sync (see project_status.md).
// Weekdays are numbered 0 = Monday ... 6 = Sunday.

export type Repeat = {
  freq: 'day' | 'week' | 'month' | 'year'
  every: number // every 1 / 2 / 3 ... days, weeks, months or years
  weekdays?: number[] // week: which days (empty = the day of the start date)
  monthDays?: number[] // month: dates 1..31, -1 = last day (empty = the date of the start date)
  nth?: { n: 1 | 2 | 3 | 4 | -1; weekday: number } // month: "the first Monday", "the last Friday"
  exceptWeekdays?: number[] // never on these weekdays
  exceptWeeks?: number[] // never in these weeks of the month: 1..4, or -1 = the last week
  exceptDates?: string[] // single days taken out of the series (moved by hand to another time)
  until?: string | null // YYYY-MM-DD, last possible day
  count?: number | null // or: stop after this many times
}

const DAY = 86400000
const ms = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const dayNum = (s: string) => Math.round(ms(s) / DAY)
const weekdayOf = (s: string) => (new Date(ms(s)).getUTCDay() + 6) % 7
const parts = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

export function addDaysStr(s: string, n: number): string {
  return new Date(ms(s) + n * DAY).toISOString().slice(0, 10)
}

function pattern(r: Repeat, start: string, ymd: string): boolean {
  const every = Math.max(1, Math.floor(r.every || 1))
  const a = parts(start)
  const b = parts(ymd)
  switch (r.freq) {
    case 'day':
      return (dayNum(ymd) - dayNum(start)) % every === 0
    case 'week': {
      const weeks = Math.floor((dayNum(ymd) - weekdayOf(ymd) - (dayNum(start) - weekdayOf(start))) / 7)
      if (weeks % every !== 0) return false
      const days = r.weekdays?.length ? r.weekdays : [weekdayOf(start)]
      return days.includes(weekdayOf(ymd))
    }
    case 'month': {
      if (((b.y - a.y) * 12 + (b.m - a.m)) % every !== 0) return false
      if (r.nth) {
        if (weekdayOf(ymd) !== r.nth.weekday) return false
        if (r.nth.n === -1) return b.d + 7 > daysInMonth(b.y, b.m)
        return Math.ceil(b.d / 7) === r.nth.n
      }
      const days = r.monthDays?.length ? r.monthDays : [a.d]
      return days.includes(b.d) || (days.includes(-1) && b.d === daysInMonth(b.y, b.m))
    }
    case 'year':
      return (b.y - a.y) % every === 0 && b.m === a.m && b.d === a.d
  }
}

function excluded(r: Repeat, ymd: string): boolean {
  if (r.exceptWeekdays?.includes(weekdayOf(ymd))) return true
  if (r.exceptWeeks?.length) {
    const { y, m, d } = parts(ymd)
    if (r.exceptWeeks.includes(Math.ceil(d / 7))) return true
    if (r.exceptWeeks.includes(-1) && d + 7 > daysInMonth(y, m)) return true
  }
  return false
}

/** Used when mirroring to Google Calendar: does the plain pattern hit this day, ignoring the 'skip' rules? */
export const matchesPattern = pattern
export const isExcluded = excluded

function matches(r: Repeat, start: string, ymd: string): boolean {
  return pattern(r, start, ymd) && !excluded(r, ymd)
}

/** Does a task that starts on `start` and repeats like `r` happen on the day `ymd`? */
export function occursOn(start: string | null, r: Repeat | null | undefined, ymd: string): boolean {
  if (!start || !r || ymd < start) return false
  if (r.until && ymd > r.until) return false
  if (r.exceptDates?.includes(ymd)) return false
  if (!matches(r, start, ymd)) return false
  if (r.count && r.count > 0) {
    const total = dayNum(ymd) - dayNum(start)
    if (total > 20000) return false
    let n = 0
    for (let i = 0; i <= total; i++) {
      if (matches(r, start, addDaysStr(start, i)) && ++n > r.count) return false
    }
  }
  return true
}

/** All days in [from, to] (YYYY-MM-DD, at most ~400 days) on which the task happens. */
export function occurrencesBetween(start: string | null, r: Repeat | null | undefined, from: string, to: string): string[] {
  if (!start || !r) return []
  const out: string[] = []
  let d = from < start ? start : from
  for (let i = 0; i < 420 && d <= to; i++, d = addDaysStr(d, 1)) if (occursOn(start, r, d)) out.push(d)
  return out
}

/** The first real occurrence on or after `start` (so the saved start date is always a day it really happens). */
export function firstOccurrence(start: string, r: Repeat): string {
  let d = start
  for (let i = 0; i < 800; i++, d = addDaysStr(d, 1)) if (matches(r, start, d) && (!r.until || d <= r.until)) return d
  return start
}

/** The last day of the series when it stops after `count` times (null = no end). */
export function lastOccurrence(start: string, r: Repeat): string | null {
  if (r.until) return r.until
  if (!r.count || r.count < 1) return null
  let d = start
  let n = 0
  for (let i = 0; i < 3700; i++, d = addDaysStr(d, 1)) if (matches(r, start, d) && ++n >= r.count) return d
  return null
}

/** Remove empty bits and nonsense so the saved value is tidy. */
export function cleanRepeat(r: Repeat): Repeat {
  const out: Repeat = { freq: r.freq, every: Math.min(99, Math.max(1, Math.floor(r.every || 1))) }
  const uniq = (a?: number[]) => (a?.length ? [...new Set(a)].sort((x, y) => x - y) : undefined)
  if (r.freq === 'week' && uniq(r.weekdays)) out.weekdays = uniq(r.weekdays)
  if (r.freq === 'month') {
    if (r.nth) out.nth = r.nth
    else if (uniq(r.monthDays)) out.monthDays = uniq(r.monthDays)
  }
  if (r.freq !== 'year') {
    if (uniq(r.exceptWeekdays)) out.exceptWeekdays = uniq(r.exceptWeekdays)
    if (uniq(r.exceptWeeks)) out.exceptWeeks = uniq(r.exceptWeeks)
  }
  if (r.exceptDates?.length) out.exceptDates = [...new Set(r.exceptDates)].sort()
  if (r.until) out.until = r.until
  else if (r.count && r.count > 0) out.count = Math.min(999, Math.floor(r.count))
  return out
}

// ---------- words ----------
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const NTH = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', [-1]: 'last' } as Record<number, string>
const ordinal = (n: number) => (n === -1 ? 'last day' : n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'))

/** "Every 2 weeks on Mon, Wed, except the first week of the month" */
export function describeRepeat(r: Repeat, start?: string | null): string {
  const e = Math.max(1, r.every || 1)
  const unit = { day: 'day', week: 'week', month: 'month', year: 'year' }[r.freq]
  let s = e === 1 ? `Every ${unit}` : `Every ${e} ${unit}s`
  if (r.freq === 'week') {
    const days = r.weekdays?.length ? r.weekdays : start ? [weekdayOf(start)] : []
    if (days.length) s += ' on ' + days.map((d) => DAY_NAMES[d]).join(', ')
  }
  if (r.freq === 'month') {
    if (r.nth) s += ` on the ${NTH[r.nth.n]} ${DAY_NAMES[r.nth.weekday]}`
    else {
      const days = r.monthDays?.length ? r.monthDays : start ? [parts(start).d] : []
      if (days.length) s += ' on the ' + days.map(ordinal).join(', ')
    }
  }
  const ex: string[] = []
  if (r.exceptWeekdays?.length) ex.push(r.exceptWeekdays.map((d) => DAY_NAMES[d]).join(', '))
  if (r.exceptWeeks?.length) ex.push('the ' + r.exceptWeeks.map((w) => NTH[w]).join(' and ') + (r.exceptWeeks.length > 1 ? ' weeks' : ' week') + ' of the month')
  if (ex.length) s += ', except ' + ex.join(' and ')
  if (r.until) s += ` until ${r.until}`
  else if (r.count) s += `, ${r.count} time${r.count === 1 ? '' : 's'}`
  return s
}
