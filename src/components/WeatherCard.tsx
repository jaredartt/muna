import { useMemo } from 'react'
import WeatherIcon from './WeatherIcon'
import { useForecast, describeCode, problems, problemText, badness, isOutdoor, type WeatherDay } from '../lib/weather'
import { todayStr, parseDateStr } from '../lib/dates'

export type Plan = { title: string; date: string; text: string } // text = title + notes, used to spot outdoor plans

const dayName = (date: string, today: string) => {
  if (date === today) return 'today'
  const d = parseDateStr(date)
  const t = parseDateStr(today)
  if (Math.round((d.getTime() - t.getTime()) / 86400000) === 1) return 'tomorrow'
  return d.toLocaleDateString('en-GB', { weekday: 'long' })
}
const short = (date: string) => parseDateStr(date).toLocaleDateString('en-GB', { weekday: 'short' })
const deg = (n: number) => `${Math.round(n)}°`
const dry = (d: WeatherDay) => ((d.rainPct ?? 0) < 30 && d.rainMm < 1 ? 'dry' : `rain ${d.rainPct ?? 0}%`)

/** A kind, short note about one day that suits being outside (or null). */
function niceDay(days: WeatherDay[]): WeatherDay | null {
  const ok = days.slice(0, 7).filter((d) => badness(d) === 0 && d.max >= 14 && d.max <= 28)
  if (!ok.length) return null
  return ok.sort((a, b) => b.max - a.max)[0] // the warmest comfortable day
}

export default function WeatherCard({ plans }: { plans: Plan[] }) {
  const { forecast, place, failed } = useForecast()
  const today = todayStr()

  const { warnings, tip } = useMemo(() => {
    const out: string[] = []
    let tipText = ''
    if (!forecast) return { warnings: out, tip: tipText }
    const days = forecast.days.filter((d) => d.date >= today)
    const byDate = new Map(days.map((d) => [d.date, d]))
    const seen = new Set<string>()
    for (const p of plans) {
      const day = byDate.get(p.date)
      if (!day || !isOutdoor(p.text) || seen.has(p.title + p.date)) continue
      const bad = badness(day)
      if (bad === 0) continue
      seen.add(p.title + p.date)
      const better = days
        .slice(0, 8)
        .filter((d) => d.date !== p.date && badness(d) < bad && badness(d) === 0)
        .sort((a, b) => Math.abs(parseDateStr(a.date).getTime() - parseDateStr(p.date).getTime()) - Math.abs(parseDateStr(b.date).getTime() - parseDateStr(p.date).getTime()))[0]
      out.push(
        `${p.title} (${dayName(p.date, today)}): ${problemText(day)}.` + (better ? ` ${dayName(better.date, today)[0].toUpperCase() + dayName(better.date, today).slice(1)} looks better: ${deg(better.max)}, ${dry(better)}.` : ''),
      )
    }
    if (!out.length) {
      const nice = niceDay(days)
      if (nice) tipText = `${dayName(nice.date, today)[0].toUpperCase() + dayName(nice.date, today).slice(1)} looks lovely (${deg(nice.max)}, ${dry(nice)}). A good day to be outside!`
    }
    return { warnings: out.slice(0, 3), tip: tipText }
  }, [forecast, plans, today])

  if (!forecast) {
    return (
      <>
        <div className="card-head">
          <h3>Weather</h3>
          <span className="muted small">{place.name}</span>
        </div>
        <p className="muted small">{failed ? 'Could not load the weather. Check your internet.' : 'Loading…'}</p>
      </>
    )
  }

  const todayDay = forecast.days.find((d) => d.date === today) ?? forecast.days[0]
  const nowCode = forecast.now?.code ?? todayDay.code
  const info = describeCode(nowCode)
  const strip = forecast.days.filter((d) => d.date >= today).slice(0, 7)

  return (
    <>
      <div className="card-head">
        <h3>Weather</h3>
        <span className="muted small">{place.name}</span>
      </div>
      <div className="wx-now">
        <WeatherIcon kind={info.kind} size={52} night={forecast.now ? !forecast.now.isDay : false} />
        <div className="wx-temp">
          <strong>{deg(forecast.now?.temp ?? todayDay.max)}</strong>
          <span>{info.label}</span>
        </div>
        <div className="wx-facts muted small">
          <span>
            {deg(todayDay.max)} / {deg(todayDay.min)}
          </span>
          <span>Rain {todayDay.rainPct ?? 0}%</span>
          <span>Wind {Math.round(forecast.now?.wind ?? todayDay.wind)} km/h</span>
        </div>
      </div>
      <div className="wx-strip">
        {strip.map((d) => (
          <div key={d.date} className={'wx-day' + (d.date === today ? ' now' : '')}>
            <span className="wx-dn">{d.date === today ? 'Today' : short(d.date)}</span>
            <WeatherIcon kind={describeCode(d.code).kind} size={26} />
            <span className="wx-hi">{deg(d.max)}</span>
            <span className="wx-lo muted">{deg(d.min)}</span>
            <i className={'wx-dot' + (problems(d).length ? ' bad' : '')} aria-hidden="true" />
          </div>
        ))}
      </div>
      {warnings.map((w) => (
        <p key={w} className="wx-warn">
          {w}
        </p>
      ))}
      {tip && <p className="wx-tip">{tip}</p>}
    </>
  )
}
