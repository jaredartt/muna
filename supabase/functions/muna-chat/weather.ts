// Weather for Muna, from Open-Meteo (free, no key). Same thresholds as the app (src/lib/weather.ts): keep both in sync.
export type Place = { name: string; country?: string; lat: number; lon: number }
export const DEFAULT_PLACE: Place = { name: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.405 }

type Day = { date: string; code: number; max: number; min: number; rainPct: number | null; rainMm: number; wind: number }

const label = (c: number) =>
  c === 0 ? 'clear' : c === 1 ? 'mostly clear' : c === 2 ? 'partly cloudy' : c === 3 ? 'cloudy' : c === 45 || c === 48 ? 'fog' : c >= 51 && c <= 57 ? 'drizzle' : (c >= 61 && c <= 67) || (c >= 80 && c <= 82) ? 'rain' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : c >= 95 ? 'thunderstorm' : 'cloudy'

function flags(d: Day): string[] {
  const l = label(d.code)
  const f: string[] = []
  if (l === 'thunderstorm') f.push('STORM')
  if (l === 'snow') f.push('SNOW')
  if (l !== 'thunderstorm' && l !== 'snow' && ((d.rainPct ?? 0) >= 50 || d.rainMm >= 3 || l === 'rain')) f.push('RAIN')
  if (d.max < 5) f.push('COLD')
  if (d.max >= 30) f.push('HOT')
  if (d.wind >= 35) f.push('WINDY')
  return f
}

const wd = (date: string) => new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })

/** One line per day, e.g. "Sat 2026-10-03: rain, 9°/5°, rain chance 80% (6.2 mm), wind 28 km/h [RAIN]" */
export async function forecastLines(p: Place, from?: string, to?: string, maxDays = 10): Promise<string> {
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${p.lat}&longitude=${p.lon}` +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max' +
    '&timezone=auto&forecast_days=16'
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 3500)
  try {
    const res = await fetch(url, { signal: ctl.signal })
    if (!res.ok) return ''
    const j = await res.json()
    const d = j.daily
    if (!d?.time) return ''
    const days: Day[] = (d.time as string[]).map((date, i) => ({
      date,
      code: Number(d.weather_code?.[i] ?? 3),
      max: Number(d.temperature_2m_max?.[i] ?? 0),
      min: Number(d.temperature_2m_min?.[i] ?? 0),
      rainPct: d.precipitation_probability_max?.[i] == null ? null : Number(d.precipitation_probability_max[i]),
      rainMm: Number(d.precipitation_sum?.[i] ?? 0),
      wind: Number(d.wind_speed_10m_max?.[i] ?? 0),
    }))
    return days
      .filter((x) => (!from || x.date >= from) && (!to || x.date <= to))
      .slice(0, maxDays)
      .map((x) => {
        const f = flags(x)
        return `${wd(x.date)} ${x.date}: ${label(x.code)}, ${Math.round(x.max)}°/${Math.round(x.min)}°, ${x.rainPct == null ? '' : `rain chance ${x.rainPct}% `}(${x.rainMm.toFixed(1)} mm), wind ${Math.round(x.wind)} km/h${f.length ? ' [' + f.join(' ') + ']' : ''}`
      })
      .join('\n')
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

/** Looks a place up by name (a city or town). */
export async function findPlace(name: string): Promise<Place | null> {
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`)
    if (!res.ok) return null
    const r = (await res.json()).results?.[0]
    return r ? { name: r.name as string, country: r.country as string | undefined, lat: r.latitude as number, lon: r.longitude as number } : null
  } catch {
    return null
  }
}
