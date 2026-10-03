import type { ReactNode } from 'react'
import { IconChevronLeft, IconDroplet, IconSunrise, IconSunset, IconWind, IconSun, IconGauge, IconTemperature, IconDropletHalf2 } from '@tabler/icons-react'
import WeatherIcon from '../components/WeatherIcon'
import { useForecast, describeCode, problems, problemText, type WeatherDay } from '../lib/weather'
import { todayStr, parseDateStr } from '../lib/dates'
import { navigate } from '../lib/router'

const deg = (n: number) => `${Math.round(n)}°`
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const compass = (d: number) => COMPASS[Math.round(d / 45) % 8]
const uvLabel = (u: number) => (u < 3 ? 'Low' : u < 6 ? 'Moderate' : u < 8 ? 'High' : u < 11 ? 'Very high' : 'Extreme')
const dayLabel = (date: string, today: string) => {
  if (date === today) return 'Today'
  const diff = Math.round((parseDateStr(date).getTime() - parseDateStr(today).getTime()) / 86400000)
  if (diff === 1) return 'Tomorrow'
  return parseDateStr(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
const longDay = (date: string, today: string) => (date === today ? 'Today' : parseDateStr(date).toLocaleDateString('en-GB', { weekday: 'long' }))

/** The whole forecast: right now, the next 24 hours, the details of today and the next two weeks. */
export default function WeatherPage() {
  const { forecast, place, failed } = useForecast()
  const today = todayStr()

  const head = (
    <header className="page-head">
      <div className="updates-title">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="Back to Home">
          <IconChevronLeft size={24} />
        </button>
        <h1>Weather</h1>
      </div>
      <span className="muted small">{place.name}</span>
    </header>
  )

  if (!forecast) {
    return (
      <div className="page wx-page">
        {head}
        <section className="card">
          <p className="muted small">{failed ? 'Could not load the weather. Check your internet.' : 'Loading…'}</p>
        </section>
      </div>
    )
  }

  const days = forecast.days.filter((d) => d.date >= today)
  const todayDay: WeatherDay = days[0] ?? forecast.days[0]
  const info = describeCode(forecast.now?.code ?? todayDay.code)
  const night = forecast.now ? !forecast.now.isDay : false
  const now = forecast.now
  const hours = (forecast.hours ?? []).slice(0, 25)
  const lo = Math.min(...days.map((d) => d.min))
  const hi = Math.max(...days.map((d) => d.max))
  const span = Math.max(1, hi - lo)
  const heads = days
    .slice(0, 7)
    .filter((d) => problems(d).length)
    .slice(0, 5)

  const tiles: { icon: ReactNode; label: string; value: string; sub?: string }[] = []
  if (now) tiles.push({ icon: <IconTemperature size={18} />, label: 'Feels like', value: deg(now.feels) })
  if (now?.humidity != null) tiles.push({ icon: <IconDropletHalf2 size={18} />, label: 'Humidity', value: `${Math.round(now.humidity)}%` })
  tiles.push({
    icon: <IconWind size={18} />,
    label: 'Wind',
    value: `${Math.round(now?.wind ?? todayDay.wind)} km/h${now?.windDir != null ? ' ' + compass(now.windDir) : ''}`,
    sub: todayDay.gust != null ? `Gusts up to ${Math.round(todayDay.gust)} km/h` : undefined,
  })
  tiles.push({ icon: <IconDroplet size={18} />, label: 'Rain today', value: `${todayDay.rainPct ?? 0}%`, sub: todayDay.rainMm >= 0.1 ? `${todayDay.rainMm.toFixed(1)} mm expected` : 'No rain expected' })
  if (todayDay.uv != null) tiles.push({ icon: <IconSun size={18} />, label: 'UV index', value: String(Math.round(todayDay.uv)), sub: uvLabel(todayDay.uv) })
  if (now?.pressure != null) tiles.push({ icon: <IconGauge size={18} />, label: 'Pressure', value: `${Math.round(now.pressure)} hPa` })
  if (todayDay.sunrise) tiles.push({ icon: <IconSunrise size={18} />, label: 'Sunrise', value: todayDay.sunrise })
  if (todayDay.sunset) tiles.push({ icon: <IconSunset size={18} />, label: 'Sunset', value: todayDay.sunset })

  return (
    <div className="page wx-page">
      {head}

      <section className="card wx-hero">
        <WeatherIcon kind={info.kind} size={84} night={night} />
        <div className="wx-hero-temp">
          <strong>{deg(now?.temp ?? todayDay.max)}</strong>
          <span>{info.label}</span>
        </div>
        <p className="muted small">
          High {deg(todayDay.max)} · Low {deg(todayDay.min)}
        </p>
      </section>

      {heads.length > 0 && (
        <section className="card">
          <h3>Heads up</h3>
          {heads.map((d) => (
            <p key={d.date} className="wx-warn">
              <strong>{longDay(d.date, today)}:</strong> {problemText(d)}.
            </p>
          ))}
        </section>
      )}

      {hours.length > 0 && (
        <section className="card">
          <h3>Next hours</h3>
          <div className="wx-hours">
            {hours.map((h, i) => (
              <div key={h.time} className="wx-hour">
                <span className="wx-dn">{i === 0 ? 'Now' : `${h.time.slice(11, 13)}:00`}</span>
                <WeatherIcon kind={describeCode(h.code).kind} size={26} night={!h.isDay} />
                <span className="wx-hi">{deg(h.temp)}</span>
                <span className="wx-rain">{h.rainPct != null && h.rainPct >= 10 ? `${h.rainPct}%` : ' '}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h3>Today in detail</h3>
        <div className="wx-tiles">
          {tiles.map((t) => (
            <div key={t.label} className="wx-tile">
              <span className="wx-tile-label">
                {t.icon} {t.label}
              </span>
              <strong>{t.value}</strong>
              {t.sub && <span className="muted small">{t.sub}</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Next {days.length} days</h3>
        <div className="wx-list">
          {days.map((d) => (
            <div key={d.date} className={'wx-row' + (d.date === today ? ' now' : '')}>
              <span className="wx-row-day">{dayLabel(d.date, today)}</span>
              <WeatherIcon kind={describeCode(d.code).kind} size={26} />
              <span className="wx-row-rain">{(d.rainPct ?? 0) >= 10 ? `${d.rainPct}%` : ''}</span>
              <span className="wx-row-lo muted">{deg(d.min)}</span>
              <span className="wx-bar" aria-hidden="true">
                <i style={{ left: `${((d.min - lo) / span) * 100}%`, width: `${Math.max(6, ((d.max - d.min) / span) * 100)}%` }} />
              </span>
              <span className="wx-row-hi">{deg(d.max)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
