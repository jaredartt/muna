// Weather from Open-Meteo (free, no key). One place for the whole home (set in Profile, default Berlin).
// The same thresholds are used by Muna on the server (supabase/functions/muna-chat/weather.ts): keep both in sync.
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import type { Place } from './types'

export type { Place }

export const DEFAULT_PLACE: Place = { name: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.405 }

export type WeatherDay = {
  date: string // YYYY-MM-DD
  code: number // WMO weather code
  max: number
  min: number
  rainPct: number | null // chance of rain, 0-100
  rainMm: number
  wind: number // km/h, strongest
  gust?: number // km/h, strongest gust
  sunrise?: string // HH:MM
  sunset?: string // HH:MM
  uv?: number // strongest UV index of the day
}
/** One hour of the next two days. */
export type WeatherHour = { time: string; temp: number; code: number; rainPct: number | null; isDay: boolean } // time = local "YYYY-MM-DDTHH:MM"

export type Forecast = {
  place: Place
  fetched: number
  now: { temp: number; feels: number; code: number; wind: number; isDay: boolean; humidity?: number; windDir?: number; pressure?: number } | null
  days: WeatherDay[]
  hours?: WeatherHour[]
}

export type Kind = 'clear' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm'

export function describeCode(code: number): { label: string; kind: Kind } {
  if (code === 0) return { label: 'Clear', kind: 'clear' }
  if (code === 1) return { label: 'Mostly clear', kind: 'clear' }
  if (code === 2) return { label: 'Partly cloudy', kind: 'partly' }
  if (code === 3) return { label: 'Cloudy', kind: 'cloud' }
  if (code === 45 || code === 48) return { label: 'Foggy', kind: 'fog' }
  if (code >= 51 && code <= 57) return { label: 'Drizzle', kind: 'drizzle' }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: code >= 80 ? 'Rain showers' : 'Rain', kind: 'rain' }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: 'Snow', kind: 'snow' }
  if (code >= 95) return { label: 'Thunderstorm', kind: 'storm' }
  return { label: 'Cloudy', kind: 'cloud' }
}

export type Problem = 'rain' | 'storm' | 'snow' | 'cold' | 'hot' | 'wind'

/** What could spoil an outdoor plan on this day (empty = a good day). */
export function problems(d: WeatherDay): Problem[] {
  const kind = describeCode(d.code).kind
  const out: Problem[] = []
  if (kind === 'storm') out.push('storm')
  if (kind === 'snow') out.push('snow')
  if (kind !== 'storm' && kind !== 'snow' && ((d.rainPct ?? 0) >= 50 || d.rainMm >= 3 || kind === 'rain')) out.push('rain')
  if (d.max < 5) out.push('cold')
  if (d.max >= 30) out.push('hot')
  if (d.wind >= 35) out.push('wind')
  return out
}

const WEIGHT: Record<Problem, number> = { storm: 4, snow: 3, rain: 3, hot: 2, cold: 2, wind: 1 }
/** Higher = worse. A comfortable day is 0. */
export function badness(d: WeatherDay): number {
  let s = problems(d).reduce((a, p) => a + WEIGHT[p], 0)
  if (d.max >= 33) s += 2
  if (d.max < 0) s += 1
  return s
}

export function problemText(d: WeatherDay): string {
  const t = problems(d)
  const parts: string[] = []
  if (t.includes('storm')) parts.push('thunderstorms')
  if (t.includes('snow')) parts.push('snow')
  if (t.includes('rain')) parts.push(d.rainPct != null ? `rain (${d.rainPct}%)` : 'rain')
  if (t.includes('cold')) parts.push(`very cold (${Math.round(d.max)}°)`)
  if (t.includes('hot')) parts.push(`very hot (${Math.round(d.max)}°)`)
  if (t.includes('wind')) parts.push(`strong wind (${Math.round(d.wind)} km/h)`)
  return parts.join(' and ')
}

/** Is this something you do outside? Looks at the title (English and Spanish words). */
const OUTDOOR = [
  'volleyball', 'voleibol', 'voley', 'beach', 'playa', 'park', 'parque', 'picnic', 'hike', 'hiking', 'senderismo', 'walk', 'paseo', 'caminata', 'run', 'running', 'jog', 'jogging', 'correr',
  'bike', 'biking', 'cycling', 'bici', 'ciclismo', 'bbq', 'barbecue', 'barbacoa', 'asado', 'football', 'soccer', 'futbol', 'fútbol', 'tennis', 'tenis', 'padel', 'pádel', 'basketball', 'baloncesto',
  'swim', 'swimming', 'nadar', 'piscina', 'pool', 'lake', 'lago', 'camping', 'garden', 'jardin', 'jardín', 'terrace', 'terraza', 'outdoor', 'outdoors', 'outside', 'aire libre', 'market', 'mercado',
  'festival', 'kayak', 'surf', 'ski', 'skiing', 'fishing', 'pescar', 'zoo', 'excursion', 'excursión', 'trip', 'viaje', 'sunset', 'atardecer', 'frisbee', 'skate', 'climbing', 'escalada', 'golf', 'rowing', 'sailing', 'barco', 'boat',
]
const OUTDOOR_RE = new RegExp(`(^|[^\\p{L}])(${OUTDOOR.map((w) => w.replace(/\s+/g, '\\s+')).join('|')})([^\\p{L}]|$)`, 'iu')
export const isOutdoor = (text: string) => OUTDOOR_RE.test(text)

// ---------- fetching (cached on the phone for 30 minutes) ----------
const TTL = 30 * 60 * 1000
const keyOf = (p: Place) => `muna.weather.v2.${p.lat.toFixed(2)},${p.lon.toFixed(2)}`

function readCache(p: Place): Forecast | null {
  try {
    const raw = localStorage.getItem(keyOf(p))
    return raw ? ({ ...JSON.parse(raw), place: p } as Forecast) : null
  } catch {
    return null
  }
}

export async function fetchForecast(p: Place): Promise<Forecast | null> {
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${p.lat}&longitude=${p.lon}` +
    '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day,relative_humidity_2m,wind_direction_10m,surface_pressure' +
    '&hourly=temperature_2m,weather_code,precipitation_probability,is_day&forecast_hours=48' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset,uv_index_max' +
    '&timezone=auto&forecast_days=14'
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const j = await res.json()
    const d = j.daily
    if (!d?.time) return null
    const days: WeatherDay[] = (d.time as string[]).map((date, i) => ({
      date,
      code: Number(d.weather_code?.[i] ?? 3),
      max: Number(d.temperature_2m_max?.[i] ?? 0),
      min: Number(d.temperature_2m_min?.[i] ?? 0),
      rainPct: d.precipitation_probability_max?.[i] == null ? null : Number(d.precipitation_probability_max[i]),
      rainMm: Number(d.precipitation_sum?.[i] ?? 0),
      wind: Number(d.wind_speed_10m_max?.[i] ?? 0),
      gust: d.wind_gusts_10m_max?.[i] == null ? undefined : Number(d.wind_gusts_10m_max[i]),
      sunrise: typeof d.sunrise?.[i] === 'string' ? (d.sunrise[i] as string).slice(11, 16) : undefined,
      sunset: typeof d.sunset?.[i] === 'string' ? (d.sunset[i] as string).slice(11, 16) : undefined,
      uv: d.uv_index_max?.[i] == null ? undefined : Number(d.uv_index_max[i]),
    }))
    const h = j.hourly
    const hours: WeatherHour[] | undefined = h?.time
      ? (h.time as string[]).map((time, i) => ({
          time,
          temp: Number(h.temperature_2m?.[i] ?? 0),
          code: Number(h.weather_code?.[i] ?? 3),
          rainPct: h.precipitation_probability?.[i] == null ? null : Number(h.precipitation_probability[i]),
          isDay: h.is_day?.[i] !== 0,
        }))
      : undefined
    const c = j.current
    const f: Forecast = {
      place: p,
      fetched: Date.now(),
      now: c
        ? {
            temp: Number(c.temperature_2m),
            feels: Number(c.apparent_temperature),
            code: Number(c.weather_code),
            wind: Number(c.wind_speed_10m),
            isDay: c.is_day !== 0,
            humidity: c.relative_humidity_2m == null ? undefined : Number(c.relative_humidity_2m),
            windDir: c.wind_direction_10m == null ? undefined : Number(c.wind_direction_10m),
            pressure: c.surface_pressure == null ? undefined : Number(c.surface_pressure),
          }
        : null,
      days,
      hours,
    }
    try {
      localStorage.setItem(keyOf(p), JSON.stringify(f))
    } catch {
      /* fine */
    }
    return f
  } catch {
    return null
  }
}

/** Finds places by name (for the Profile picker). */
export async function searchPlaces(name: string): Promise<Place[]> {
  const q = name.trim()
  if (q.length < 2) return []
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`)
    if (!res.ok) return []
    const j = await res.json()
    return ((j.results ?? []) as { name: string; latitude: number; longitude: number; country?: string; admin1?: string }[]).map((r) => ({
      name: r.admin1 && r.admin1 !== r.name ? `${r.name}, ${r.admin1}` : r.name,
      country: r.country,
      lat: r.latitude,
      lon: r.longitude,
    }))
  } catch {
    return []
  }
}

/** The forecast for the home's place. Shows what was saved last time at once, then refreshes it. */
export function useForecast(): { forecast: Forecast | null; place: Place; failed: boolean } {
  const { weatherPlace } = useAuth()
  const place = weatherPlace ?? DEFAULT_PLACE
  const [forecast, setForecast] = useState<Forecast | null>(() => readCache(place))
  const [failed, setFailed] = useState(false)
  const k = keyOf(place)

  useEffect(() => {
    let alive = true
    const cached = readCache(place)
    setForecast(cached)
    const load = async () => {
      if (cached && Date.now() - cached.fetched < TTL) return
      const f = await fetchForecast(place)
      if (!alive) return
      if (f) {
        setForecast(f)
        setFailed(false)
      } else if (!cached) setFailed(true)
    }
    void load()
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const c = readCache(place)
      if (!c || Date.now() - c.fetched >= TTL) void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k])

  return { forecast, place, failed }
}
