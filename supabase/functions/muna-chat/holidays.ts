// Public holidays in Hesse (Frankfurt am Main), worked out from the date of Easter, so no internet is needed.
// This file has NO imports on purpose: an identical copy lives next to the server code (supabase/functions/muna-chat/holidays.ts),
// so keep the two in sync (see project_status.md).
// Hesse has: New Year, Good Friday, Easter Sunday and Monday, Labour Day, Ascension, Whit Sunday and Monday, Corpus Christi,
// German Unity Day, Christmas Day and Boxing Day. (No Reformation Day, no All Saints, no Day of Repentance.)
// Shops in Germany are closed on Sundays and on public holidays.

const DAY = 86400000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)

/** Easter Sunday (the Gregorian "Anonymous" algorithm) as a UTC timestamp. */
function easter(y: number): number {
  const a = y % 19
  const b = Math.floor(y / 100)
  const c = y % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return Date.UTC(y, month - 1, day)
}

const cache = new Map<number, Map<string, string>>()

/** All public holidays of one year in Hesse: date (YYYY-MM-DD) -> name. */
export function holidaysOf(year: number): Map<string, string> {
  const hit = cache.get(year)
  if (hit) return hit
  const e = easter(year)
  const m = new Map<string, string>([
    [`${year}-01-01`, 'New Year'],
    [iso(e - 2 * DAY), 'Good Friday'],
    [iso(e), 'Easter Sunday'],
    [iso(e + DAY), 'Easter Monday'],
    [`${year}-05-01`, 'Labour Day'],
    [iso(e + 39 * DAY), 'Ascension Day'],
    [iso(e + 49 * DAY), 'Whit Sunday'],
    [iso(e + 50 * DAY), 'Whit Monday'],
    [iso(e + 60 * DAY), 'Corpus Christi'],
    [`${year}-10-03`, 'German Unity Day'],
    [`${year}-12-25`, 'Christmas Day'],
    [`${year}-12-26`, 'Boxing Day'],
  ])
  cache.set(year, m)
  return m
}

/** The name of the public holiday on this day (YYYY-MM-DD), or null. */
export function holidayName(date: string): string | null {
  return holidaysOf(Number(date.slice(0, 4))).get(date) ?? null
}

/** Why shops are closed on this day: the holiday's name, "Sunday", or null when they are open. */
export function shopsClosed(date: string): string | null {
  const h = holidayName(date)
  if (h) return h
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0 ? 'Sunday' : null
}

/** Holidays from `from` for the next `days` days, as "Sat 2026-10-03 German Unity Day" lines (for the chat's context). */
export function upcomingHolidays(from: string, days = 60): string[] {
  const out: string[] = []
  const [y, m, d] = from.split('-').map(Number)
  const start = Date.UTC(y, m - 1, d)
  for (let i = 0; i <= days; i++) {
    const day = iso(start + i * DAY)
    const h = holidayName(day)
    if (h) out.push(`${new Date(start + i * DAY).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })} ${day} ${h}`)
  }
  return out
}
