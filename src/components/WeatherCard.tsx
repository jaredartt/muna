import WeatherIcon from './WeatherIcon'
import { useForecast, describeCode } from '../lib/weather'
import { todayStr } from '../lib/dates'

const deg = (n: number) => `${Math.round(n)}°`

/** The small Weather block on Home: just how it is now and today's high and low. Everything else is on the Weather page (tap the block). */
export default function WeatherCard() {
  const { forecast, place, failed } = useForecast()
  const today = todayStr()

  if (!forecast) {
    return (
      <>
        <div className="card-head">
          <h3>Weather</h3>
        </div>
        <p className="muted small">{failed ? 'Could not load the weather.' : 'Loading…'}</p>
      </>
    )
  }

  const todayDay = forecast.days.find((d) => d.date === today) ?? forecast.days[0]
  const info = describeCode(forecast.now?.code ?? todayDay.code)

  return (
    <>
      <div className="card-head">
        <h3>Weather</h3>
        <span className="muted small wx-place">{place.name}</span>
      </div>
      <div className="wx-now">
        <WeatherIcon kind={info.kind} size={44} night={forecast.now ? !forecast.now.isDay : false} />
        <div className="wx-temp">
          <strong>{deg(forecast.now?.temp ?? todayDay.max)}</strong>
          <span>{info.label}</span>
        </div>
        <span className="wx-facts muted small">
          {deg(todayDay.max)} / {deg(todayDay.min)}
        </span>
      </div>
    </>
  )
}
